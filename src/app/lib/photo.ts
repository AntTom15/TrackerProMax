import * as ImagePicker from 'expo-image-picker';
// SDK 54 replaced expo-file-system's functional API with File/Directory
// classes; the stable functional one lives at /legacy and is what we
// want here (verified present in expo-file-system 19.0.x).
import * as FileSystem from 'expo-file-system/legacy';

const PHOTO_DIR = 'profile';

export type PickPhotoResult =
  | { status: 'ok'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' };

/**
 * Prompt for a square profile photo and return a PERSISTENT uri.
 *
 * The picker hands back a file in the app's cache, which the OS is free
 * to clear — so the pick is copied into the document directory, which
 * isn't. `previousUri` (when it points at our own directory) is deleted
 * so old photos don't pile up. The caller needs to tell a denied
 * permission apart from a plain cancel, hence the explicit status.
 */
export async function pickProfilePhoto(
  previousUri?: string | null
): Promise<PickPhotoResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    // The avatar renders at 84px, so a heavily compressed image is
    // indistinguishable and keeps the copy small.
    quality: 0.5,
  });
  if (result.canceled || !result.assets?.length) return { status: 'cancelled' };

  const srcUri = result.assets[0].uri;
  const dir = `${FileSystem.documentDirectory}${PHOTO_DIR}`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // Already exists — makeDirectoryAsync throws rather than no-oping.
  }

  // Unique name so the <Image> cache can't serve the previous photo.
  const ext = srcUri.split('.').pop()?.split('?')[0] || 'jpg';
  const destUri = `${dir}/avatar_${Date.now()}.${ext}`;

  try {
    await FileSystem.copyAsync({ from: srcUri, to: destUri });
  } catch {
    // If the copy fails the cache uri still works for this session.
    return { status: 'ok', uri: srcUri };
  }

  await deleteProfilePhoto(previousUri);
  return { status: 'ok', uri: destUri };
}

/** Remove a stored photo. Safe to call with null or a foreign uri. */
export async function deleteProfilePhoto(uri?: string | null): Promise<void> {
  if (!uri) return;
  // Only ever delete files we created.
  if (!uri.includes(`/${PHOTO_DIR}/`)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best effort.
  }
}
