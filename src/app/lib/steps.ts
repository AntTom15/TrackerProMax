import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { endOfDay, format, subDays } from 'date-fns';

// Daily step totals keyed by yyyy-MM-dd.
export type StepsByDate = Record<string, number>;

// Steps come straight from the phone's motion chip (CMPedometer on
// iOS) — no Apple Health / dev build needed, works in Expo Go. The OS
// only answers queries ~7 days back, so every refresh snapshots the
// last week into persisted storage; older days keep their snapshot.
// Limitations: phone-carried steps only (no Watch), and Android's
// pedometer can't do historical queries — the card shows unavailable
// there.
export function useSteps(onSnapshot: (patch: StepsByDate) => void) {
  // null = still checking, false = unavailable/denied, true = live.
  const [available, setAvailable] = useState<boolean | null>(null);
  const snapshotRef = useRef(onSnapshot);
  snapshotRef.current = onSnapshot;

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const ok = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        if (!ok) {
          setAvailable(false);
          return;
        }
        const perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted) {
          const req = await Pedometer.requestPermissionsAsync();
          if (cancelled) return;
          if (!req.granted) {
            setAvailable(false);
            return;
          }
        }
        const now = new Date();
        const patch: StepsByDate = {};
        // Today plus the previous 6 days the OS still remembers.
        for (let i = 0; i < 7; i++) {
          const day = subDays(now, i);
          const end = i === 0 ? now : endOfDay(day);
          const start = new Date(day);
          start.setHours(0, 0, 0, 0);
          const res = await Pedometer.getStepCountAsync(start, end);
          patch[format(day, 'yyyy-MM-dd')] = res.steps;
        }
        if (cancelled) return;
        snapshotRef.current(patch);
        setAvailable(true);
      } catch {
        // getStepCountAsync is iOS-only; Android lands here.
        if (!cancelled) setAvailable(false);
      }
    };

    refresh();
    // Re-query whenever the app returns to the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return available;
}
