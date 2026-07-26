import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { X, HelpCircle, Save } from './Icons';
import { useNavigation } from '@react-navigation/native';
import NumericInput from './components2/NumericInput';
import { CATEGORY_ORDER } from '../lib/constants';
import type { Food, Nutrients, NutrientKey } from '../lib/types';
import { ThemeColors, useThemedStyles } from '../lib/theme';

// The draft a user submits; App assigns id / uploadedBy / votes.
export type FoodDraft = Omit<Food, 'id' | 'uploadedBy' | 'upvotes' | 'downvotes'>;

interface FoodEntryPageProps {
  onSave: (food: FoodDraft) => void;
}

interface FieldDef {
  key: NutrientKey;
  label: string;
  unit: string;
  required?: boolean;
}

interface FieldGroup {
  header: string;
  fields: FieldDef[];
  // Groups whose totals are validated against each other show errors here.
  errorKey?: 'fatProfile';
}

// ---- Field layout (data-driven so quick/advanced share one renderer) ----

const QUICK_GROUPS: FieldGroup[] = [
  { header: 'Calories', fields: [{ key: 'calories', label: 'Calories', unit: 'kcal', required: true }] },
  {
    header: 'Fat',
    errorKey: 'fatProfile',
    fields: [
      { key: 'fat', label: 'Total Fat', unit: 'g' },
      { key: 'satFat', label: 'Saturated Fat', unit: 'g' },
      { key: 'transFat', label: 'Trans Fat', unit: 'g' },
    ],
  },
  { header: 'Cholesterol', fields: [{ key: 'cholesterol', label: 'Cholesterol', unit: 'mg' }] },
  { header: 'Sodium', fields: [{ key: 'sodium', label: 'Sodium', unit: 'mg' }] },
  {
    header: 'Carbohydrates',
    fields: [
      { key: 'carbs', label: 'Total Carbs', unit: 'g' },
      { key: 'fiber', label: 'Dietary Fiber', unit: 'g' },
      { key: 'sugars', label: 'Total Sugars', unit: 'g' },
    ],
  },
  { header: 'Protein', fields: [{ key: 'protein', label: 'Protein', unit: 'g' }] },
];

interface AdvancedSection {
  header: string;
  errorKey?: 'fatProfile';
  subs: { label?: string; fields: FieldDef[] }[];
}

const ADVANCED_SECTIONS: AdvancedSection[] = [
  {
    header: 'Energy and Macros',
    subs: [{
      fields: [
        { key: 'calories', label: 'Calories', unit: 'kcal', required: true },
        { key: 'protein', label: 'Protein', unit: 'g' },
        { key: 'carbs', label: 'Total Carbohydrates', unit: 'g' },
        { key: 'fat', label: 'Total Fat', unit: 'g' },
      ],
    }],
  },
  {
    header: 'Carbohydrate Details',
    subs: [{
      fields: [
        { key: 'fiber', label: 'Dietary Fiber', unit: 'g' },
        { key: 'sugars', label: 'Total Sugars', unit: 'g' },
      ],
    }],
  },
  {
    header: 'Fat Profile',
    errorKey: 'fatProfile',
    subs: [{
      fields: [
        { key: 'satFat', label: 'Saturated Fat', unit: 'g' },
        { key: 'monoFat', label: 'Monounsaturated Fat', unit: 'g' },
        { key: 'polyFat', label: 'Polyunsaturated Fat', unit: 'g' },
        { key: 'omega3', label: 'Omega-3', unit: 'mg' },
        { key: 'omega6', label: 'Omega-6', unit: 'mg' },
        { key: 'transFat', label: 'Trans Fat', unit: 'g' },
        { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
      ],
    }],
  },
  {
    header: 'Vitamins',
    subs: [{
      fields: [
        { key: 'vitaminA', label: 'Vitamin A', unit: 'RAE' },
        { key: 'vitaminB1', label: 'Vitamin B1', unit: 'mg' },
        { key: 'vitaminB2', label: 'Vitamin B2', unit: 'mg' },
        { key: 'vitaminB3', label: 'Vitamin B3', unit: 'NE' },
        { key: 'vitaminB5', label: 'Vitamin B5', unit: 'mg' },
        { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg' },
        { key: 'vitaminB7', label: 'Vitamin B7', unit: 'mcg' },
        { key: 'vitaminB9', label: 'Vitamin B9', unit: 'mcg DFE' },
        { key: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg' },
        { key: 'vitaminC', label: 'Vitamin C', unit: 'mg' },
        { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg' },
        { key: 'vitaminE', label: 'Vitamin E', unit: 'mg' },
        { key: 'vitaminK1', label: 'Vitamin K1', unit: 'mcg' },
        { key: 'vitaminK2', label: 'Vitamin K2', unit: 'mcg' },
        { key: 'choline', label: 'Choline', unit: 'mg' },
      ],
    }],
  },
  {
    header: 'Minerals',
    subs: [
      {
        label: 'A. Major Minerals',
        fields: [
          { key: 'sodium', label: 'Sodium', unit: 'mg' },
          { key: 'potassium', label: 'Potassium', unit: 'mg' },
          { key: 'chloride', label: 'Chloride', unit: 'mg' },
          { key: 'calcium', label: 'Calcium', unit: 'mg' },
          { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
          { key: 'phosphorus', label: 'Phosphorus', unit: 'mg' },
        ],
      },
      {
        label: 'B. Trace Minerals',
        fields: [
          { key: 'iron', label: 'Iron', unit: 'mg' },
          { key: 'zinc', label: 'Zinc', unit: 'mg' },
          { key: 'copper', label: 'Copper', unit: 'mg' },
          { key: 'manganese', label: 'Manganese', unit: 'mg' },
          { key: 'iodine', label: 'Iodine', unit: 'mcg' },
          { key: 'selenium', label: 'Selenium', unit: 'mcg' },
          { key: 'chromium', label: 'Chromium', unit: 'mcg' },
          { key: 'molybdenum', label: 'Molybdenum', unit: 'mcg' },
        ],
      },
    ],
  },
];

// ---- Small presentational pieces ----

function Field({
  label,
  unit,
  optional = true,
  value,
  onChange,
  error,
}: {
  label: string;
  unit?: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const { c, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={[styles.fieldLabel, { marginBottom: 0 }, !!error && { color: c.danger }]}>
          {label}
          {optional && <Text style={styles.optional}> (opt)</Text>}
        </Text>
        {!!error && <Text style={styles.sectionHeaderErrorMsg}>{error}</Text>}
      </View>
      <View style={styles.fieldInput}>
        <NumericInput
          placeholder="—"
          value={value}
          onChangeText={onChange}
          style={[styles.numberInput, { flex: 1, minHeight: 25, textAlign: 'left' }]}
          placeholderTextColor={c.textMuted}
        />
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

function SectionHeader({ label, error }: { label: string; error?: string | null }) {
  const { c, styles } = useThemedStyles(createStyles);
  if (error) {
    return (
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, styles.sectionHeaderTextError]}>{label}</Text>
        <Text style={styles.sectionHeaderErrorMsg}>{error}</Text>
      </View>
    );
  }
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function SubHeader({ label }: { label: string }) {
  const { c, styles } = useThemedStyles(createStyles);
  return <Text style={styles.subHeader}>{label}</Text>;
}

// ---- Page ----

export default function FoodEntryPage({ onSave }: FoodEntryPageProps) {
  const { c, styles } = useThemedStyles(createStyles);
  const navigation = useNavigation();

  const [foodName, setFoodName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // null until the user picks — saving without a category is a validation error.
  const [category, setCategory] = useState<string | null>(null);
  const [servingSize, setServingSize] = useState('');
  const [servingName, setServingName] = useState('');
  const [servingWeight, setServingWeight] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [entryMode, setEntryMode] = useState<'quick' | 'advanced'>('quick');
  const [fatProfileError, setFatProfileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const foodNameRef = useRef<View>(null);
  const caloriesRef = useRef<View>(null);

  const setValue = (key: string) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const scrollToFieldRef = (viewRef: { current: View | null }) => {
    if (!viewRef.current || !scrollViewRef.current) return;
    (viewRef.current as any).measure((_x: number, _y: number, _w: number, _h: number, _px: number, pageY: number) => {
      (scrollViewRef.current as any).measure((_sx: number, _sy: number, _sw: number, _sh: number, _spx: number, spY: number) => {
        scrollViewRef.current!.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + pageY - spY - 20),
          animated: true,
        });
      });
    });
  };

  const handleSave = () => {
    // Required field validation
    const errors: Record<string, string> = {};
    if (!foodName.trim()) errors['foodName'] = 'Required';
    if (!category) errors['category'] = 'Required';
    if (!values['calories']?.trim()) errors['calories'] = 'Required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors['foodName'] || errors['category']) {
        scrollToFieldRef(foodNameRef);
      } else if (errors['calories']) {
        scrollToFieldRef(caloriesRef);
      }
      return;
    }

    // Fat profile validation
    const parse = (key: string) => parseFloat(values[key] ?? '') || 0;
    const hasValue = (key: string) => !!values[key]?.trim();

    const totalFat = parse('fat');
    const satFat = parse('satFat');
    const transFat = parse('transFat');

    if (entryMode === 'quick') {
      if (hasValue('fat') && satFat + transFat > totalFat) {
        setFatProfileError('Fats exceed the listed total fat');
        return;
      }
    } else {
      const monoFat = parse('monoFat');
      const polyFat = parse('polyFat');
      const omega3 = parse('omega3');
      const omega6 = parse('omega6');

      if (hasValue('fat') && satFat + transFat + monoFat + polyFat > totalFat) {
        setFatProfileError('Fats exceed the listed total fat');
        return;
      }
      if (hasValue('polyFat') && (omega3 + omega6) / 1000 > polyFat) {
        setFatProfileError('Omega fatty acids exceed polyunsaturated fat');
        return;
      }
    }

    setFatProfileError(null);
    setFieldErrors({});

    // Collect every entered nutrient as a number.
    const nutrients: Nutrients = {};
    (Object.entries(values) as [NutrientKey, string][]).forEach(([key, raw]) => {
      const n = parseFloat(raw);
      if (raw?.trim() && Number.isFinite(n)) nutrients[key] = n;
    });

    // Gram weight of one serving: explicit weight wins; a bare numeric
    // serving with no unit name is assumed to be grams.
    const weight = parseFloat(servingWeight);
    const size = parseFloat(servingSize);
    const servingWeightGrams = Number.isFinite(weight)
      ? weight
      : !servingName && Number.isFinite(size)
        ? size
        : undefined;

    onSave({
      name: foodName.trim(),
      category: category!,
      servingLabel: servingSize
        ? `${servingSize}${servingName ? ` ${servingName}` : 'g'}`
        : '100g',
      servingWeightGrams,
      nutrients,
    });
    navigation.goBack();
  };

  const renderField = ({ key, label, unit, required }: FieldDef) => {
    const field = (
      <Field
        key={key}
        label={label}
        unit={unit}
        optional={!required}
        error={fieldErrors[key]}
        value={values[key] ?? ''}
        onChange={setValue(key)}
      />
    );
    // Keep a ref on calories so validation can scroll to it.
    return key === 'calories' ? (
      <View key={key} ref={caloriesRef}>{field}</View>
    ) : (
      field
    );
  };

  const basicInfo = (
    <>
      <SectionHeader label="Basic Information" />
      <View style={styles.section}>
        <View ref={foodNameRef} style={styles.field}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[styles.fieldLabel, { marginBottom: 0 }, !!fieldErrors['foodName'] && { color: c.danger }]}>
              Food Name <Text style={styles.required}>*</Text>
            </Text>
            {!!fieldErrors['foodName'] && (
              <Text style={styles.sectionHeaderErrorMsg}>{fieldErrors['foodName']}</Text>
            )}
          </View>
          <TextInput
            placeholder="e.g. Atlantic Salmon (Raw)"
            value={foodName}
            onChangeText={setFoodName}
            style={styles.textInput}
            placeholderTextColor={c.textMuted}
          />
        </View>

        <View style={styles.field}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.fieldLabel, !!fieldErrors['category'] && { color: c.danger }]}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            {!!fieldErrors['category'] && (
              <Text style={styles.sectionHeaderErrorMsg}>{fieldErrors['category']}</Text>
            )}
          </View>

          <Pressable
            style={[styles.pickerPlaceholder, pickerOpen && styles.pickerPlaceholderOpen]}
            onPress={() => setPickerOpen(!pickerOpen)}
          >
            <Text style={[styles.pickerText, !category && { color: c.textMuted, fontWeight: '400' }]}>
              {category ?? 'Choose category'}
            </Text>
          </Pressable>

          {pickerOpen && (
            <View style={styles.dropdown}>
              {CATEGORY_ORDER.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.dropdownOption,
                    category === option && styles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    setCategory(option);
                    setPickerOpen(false);
                    setFieldErrors((prev) => {
                      const { category: _removed, ...rest } = prev;
                      return rest;
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      category === option && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Serving Size</Text>
          <NumericInput
            placeholder="100"
            value={servingSize}
            onChangeText={setServingSize}
            style={styles.textInput}
            placeholderTextColor={c.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Serving Name</Text>
          <TextInput
            placeholder="e.g. grams"
            value={servingName}
            onChangeText={setServingName}
            style={styles.textInput}
            placeholderTextColor={c.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Serving Weight</Text>
          <NumericInput
            placeholder="100"
            value={servingWeight}
            onChangeText={setServingWeight}
            style={styles.textInput}
            placeholderTextColor={c.textMuted}
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn}>
          <HelpCircle size={22} color={c.textMuted} />
        </Pressable>
        <Text style={styles.title}>Add a Food Entry</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={22} color={c.textMuted} />
        </Pressable>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggleContainer}>
        <Pressable
          style={[styles.modeToggleBtn, entryMode === 'quick' && styles.modeToggleBtnActive]}
          onPress={() => { setEntryMode('quick'); setFatProfileError(null); }}
        >
          <Text style={[styles.modeToggleText, entryMode === 'quick' && styles.modeToggleTextActive]}>
            Quick Add
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeToggleBtn, entryMode === 'advanced' && styles.modeToggleBtnActive]}
          onPress={() => { setEntryMode('advanced'); setFatProfileError(null); }}
        >
          <Text style={[styles.modeToggleText, entryMode === 'advanced' && styles.modeToggleTextActive]}>
            Advanced Add
          </Text>
        </Pressable>
      </View>

      {/* Scrollable form */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.form}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        {basicInfo}

        {entryMode === 'quick' ? (
          <>
            <SectionHeader label="Nutrition Facts" />
            <View style={styles.section}>
              {QUICK_GROUPS.map((group) => (
                <View key={group.header}>
                  <View style={[styles.mediumHeaderContainer, { flexDirection: 'row', alignItems: 'center' }]}>
                    <Text style={[styles.mediumHeader, group.errorKey === 'fatProfile' && !!fatProfileError && { color: c.danger }]}>
                      {group.header}
                    </Text>
                    {group.errorKey === 'fatProfile' && !!fatProfileError && (
                      <Text style={styles.sectionHeaderErrorMsg}>{fatProfileError}</Text>
                    )}
                  </View>
                  {group.fields.map(renderField)}
                </View>
              ))}
            </View>
          </>
        ) : (
          ADVANCED_SECTIONS.map((section) => (
            <View key={section.header}>
              <SectionHeader
                label={section.header}
                error={section.errorKey === 'fatProfile' ? fatProfileError : null}
              />
              {section.subs.map((sub, i) => (
                <View key={sub.label ?? i}>
                  {sub.label && <SubHeader label={sub.label} />}
                  <View style={styles.section}>{sub.fields.map(renderField)}</View>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <Pressable
        onPress={handleSave}
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.6 }]}
      >
        <Save size={18} color={c.onAccent} />
        <Text style={styles.saveBtnText}>Save</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: c.cardAlt,
    alignItems: 'center',
  },
  modeToggleBtnActive: {
    backgroundColor: c.accent,
  },
  modeToggleText: {
    fontSize: 13,
    color: c.textMuted,
    fontWeight: '500',
    fontFamily: 'DM Sans',
  },
  modeToggleTextActive: {
    color: c.onAccent,
    fontWeight: '700',
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 2,
    borderColor: c.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  field: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  required: {
    color: c.danger,
  },
  optional: {
    fontSize: 10,
    color: c.textMuted,
  },
  textInput: {
    color: c.text,
    fontSize: 14,
    fontFamily: 'DM Sans',
    paddingVertical: 4,
  },
  fieldInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numberInput: {
    color: c.text,
    fontSize: 14,
    fontFamily: 'DM Sans',
    textAlign: 'right',
    paddingVertical: 4,
  },
  unit: {
    fontSize: 11,
    color: c.textMuted,
    fontFamily: 'DM Sans',
    minWidth: 24,
  },
  pickerPlaceholder: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: c.text,
    borderRadius: 12,
    backgroundColor: c.surface,
    marginTop: 4,
  },
  pickerPlaceholderOpen: {
    borderWidth: 2,
    borderColor: c.blue,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  pickerText: {
    fontSize: 14,
    color: c.text,
    fontWeight: '600',
    fontFamily: 'DM Sans',
  },
  dropdown: {
    marginTop: 10,
    borderWidth: 2,
    borderColor: c.blue,
    borderRadius: 12,
    backgroundColor: c.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.cardAlt,
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: c.blue,
    paddingHorizontal: 10,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: c.text,
    fontFamily: 'DM Sans',
  },
  dropdownOptionTextSelected: {
    color: c.blue,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: c.text,
    fontWeight: '700',
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 10,
    letterSpacing: 0.6,
    color: c.textMuted,
    fontWeight: '600',
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  mediumHeaderContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  mediumHeader: {
    fontSize: 16,
    letterSpacing: 0.4,
    color: c.text,
    fontWeight: '800',
    fontFamily: 'DM Sans',
  },
  saveBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.text,
    shadowColor: c.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: c.onAccent,
    letterSpacing: 0.4,
    fontFamily: 'Barlow Condensed',
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeaderTextError: {
    color: c.danger,
    marginTop: 0,
    marginBottom: 0,
  },
  sectionHeaderErrorMsg: {
    fontSize: 10,
    color: c.danger,
    marginLeft: 8,
    fontFamily: 'DM Sans',
    fontWeight: '500',
  },
});
