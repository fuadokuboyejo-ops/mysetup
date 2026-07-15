import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native';

const mono = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });
const BARCODE_BARS = [3, 1, 2, 4, 1, 3, 1, 1, 2, 3, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 3, 2, 4, 1, 2, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2];

const CATEGORY_IMAGES = {
  mouse: require('../assets/mouse_pic.png'),
  monitor: require('../assets/monitor_pic.png'),
  keyboard: require('../assets/keyboard_pic.png'),
  pc_tower: require('../assets/pc_pic.png'),
  deskmat: require('../assets/mousepad_pic.png'),
  other: require('../assets/other_pic.png'),
};

const CATEGORY_CONFIG = {
  mouse: {
    label: 'MOUSE',
    nameKey: 'model',
    fields: [
      { key: 'brand', label: 'BRAND', placeholder: 'Logitech, Razer, Pulsar…' },
      { key: 'model', label: 'MODEL', placeholder: 'G Pro X Superlight…', required: true },
      { key: 'weight', label: 'WEIGHT', placeholder: '63', suffix: 'g', keyboardType: 'numbers-and-punctuation', chips: ['45', '55', '63', '75', '90'], chipSuffix: 'g' },
      { key: 'connection', label: 'CONNECTION', optional: true, placeholder: 'Wireless', chips: ['Wireless', 'Wired'] },
      { key: 'dpi', label: 'DPI', optional: true, placeholder: '26000', keyboardType: 'numbers-and-punctuation' },
      { key: 'switches', label: 'SWITCH', optional: true, placeholder: 'Optical' },
    ],
    barcode: values => `${values.weight || '--'}g · ${connectionCode(values.connection)}`,
    buildProduct: values => ({
      ...baseProduct(values.model, values.brand, 'mouse'),
      mouse_specs: {
        brand: clean(values.brand), weight: clean(values.weight), dpi: clean(values.dpi),
        connection: clean(values.connection), switches: clean(values.switches), polling: '', sensor: '',
      },
    }),
  },
  keyboard: {
    label: 'KEYBOARD',
    nameKey: 'model',
    fields: [
      { key: 'brand', label: 'BRAND', placeholder: 'Keychron, Wooting…' },
      { key: 'model', label: 'MODEL', placeholder: 'Q1 Pro, 80HE…', required: true },
      { key: 'percentage', label: 'SIZE', optional: true, placeholder: '75%', chips: ['60%', '65%', '75%', 'TKL', '100%'] },
      { key: 'switches', label: 'SWITCHES', optional: true, placeholder: 'Gateron Brown' },
      { key: 'layout', label: 'LAYOUT', optional: true, placeholder: 'ANSI', chips: ['ANSI', 'ISO', 'Alice'] },
      { key: 'connection', label: 'CONNECTION', optional: true, placeholder: 'Wireless', chips: ['Wireless', 'Wired'] },
    ],
    barcode: values => `${values.percentage || '--'} · ${values.layout || '--'}`,
    buildProduct: values => ({
      ...baseProduct(values.model, values.brand, 'keyboard'),
      keyboard_specs: {
        percentage: clean(values.percentage), switches: clean(values.switches),
        layout: clean(values.layout), connection: clean(values.connection),
      },
    }),
  },
  monitor: {
    label: 'MONITOR',
    nameKey: 'model',
    fields: [
      { key: 'brand', label: 'BRAND', placeholder: 'LG, Samsung, Dell…' },
      { key: 'model', label: 'MODEL', placeholder: 'Odyssey G7, 27GP850…', required: true },
      { key: 'hz', label: 'REFRESH', optional: true, placeholder: '144', suffix: 'Hz', keyboardType: 'numbers-and-punctuation', chips: ['60', '120', '144', '165', '240'], chipSuffix: 'Hz' },
      { key: 'inches', label: 'SIZE', optional: true, placeholder: '27', suffix: 'in', keyboardType: 'numbers-and-punctuation', chips: ['24', '27', '32', '34', '49'], chipSuffix: '″' },
      { key: 'resolution', label: 'RESOLUTION', optional: true, placeholder: '1440p', chips: ['1080p', '1440p', '4K', 'Ultrawide'] },
      { key: 'features', label: 'PANEL / FEATURES', optional: true, placeholder: 'IPS, HDR', chips: ['IPS', 'VA', 'OLED', 'HDR', 'Curved'], multiple: true },
    ],
    barcode: values => `${values.inches || '--'}in · ${values.hz || '--'}Hz`,
    buildProduct: values => ({
      ...baseProduct(values.model, values.brand, 'monitor'),
      monitor_specs: {
        hz: clean(values.hz), inches: clean(values.inches), resolution: clean(values.resolution),
        features: splitValues(values.features),
      },
    }),
  },
  deskmat: {
    label: 'DESK MAT',
    nameKey: 'model',
    fields: [
      { key: 'brand', label: 'BRAND', placeholder: 'Glorious, X-raypad…' },
      { key: 'model', label: 'MODEL', placeholder: 'Model or design name', required: true },
      { key: 'size', label: 'SIZE', optional: true, placeholder: '900 × 400 mm', chips: ['Small', 'Medium', 'Large', 'XL'] },
      { key: 'material', label: 'SURFACE', optional: true, placeholder: 'Cloth', chips: ['Cloth', 'Glass', 'Hybrid', 'Leather'] },
      { key: 'thickness', label: 'THICKNESS', optional: true, placeholder: '4', suffix: 'mm', keyboardType: 'numbers-and-punctuation' },
      { key: 'color', label: 'COLOR', optional: true, placeholder: 'Black' },
    ],
    barcode: values => `${values.size || '--'} · ${values.material || '--'}`,
    buildProduct: values => ({
      ...baseProduct(values.model, values.brand, 'deskmat'),
      deskmat_specs: {
        size: clean(values.size), material: clean(values.material),
        thickness: clean(values.thickness), color: clean(values.color),
      },
    }),
  },
  pc_tower: {
    label: 'PC TOWER',
    nameKey: 'case',
    requireAny: ['cpu', 'gpu', 'case'],
    fields: [
      { key: 'case', label: 'CASE', placeholder: 'Lian Li O11, NR200…' },
      { key: 'cpu', label: 'CPU', placeholder: 'Ryzen 7 7800X3D' },
      { key: 'gpu', label: 'GPU', placeholder: 'RTX 4070 Super' },
      { key: 'motherboard', label: 'MOTHERBOARD', optional: true, placeholder: 'B650 Tomahawk' },
      { key: 'psu', label: 'POWER SUPPLY', optional: true, placeholder: '850W' },
      { key: 'rgb', label: 'RGB', optional: true, placeholder: 'Yes', chips: ['Yes', 'No'] },
    ],
    barcode: values => `${shorten(values.cpu)} · ${shorten(values.gpu)}`,
    buildProduct: values => ({
      ...baseProduct(clean(values.case) || [clean(values.cpu), clean(values.gpu)].filter(Boolean).join(' · ') || 'Custom PC', '', 'pc tower'),
      pc_specs: {
        cpu: clean(values.cpu), gpu: clean(values.gpu), psu: clean(values.psu),
        motherboard: clean(values.motherboard), case: clean(values.case), rgb: clean(values.rgb),
      },
    }),
  },
  other: {
    label: 'OTHER GEAR',
    nameKey: 'name',
    fields: [
      { key: 'brand', label: 'BRAND', optional: true, placeholder: 'Brand' },
      { key: 'name', label: 'ITEM NAME', placeholder: 'Headset, mic, lamp…', required: true },
      { key: 'category', label: 'CATEGORY', optional: true, placeholder: 'Accessory', chips: ['Headset', 'Audio', 'Lighting', 'Accessory'] },
      { key: 'model', label: 'MODEL', optional: true, placeholder: 'Model number' },
      { key: 'color', label: 'COLOR', optional: true, placeholder: 'Black' },
      { key: 'notes', label: 'NOTES', optional: true, placeholder: 'Anything worth remembering' },
    ],
    barcode: values => `${values.category || 'GEAR'} · ${values.model || '--'}`,
    buildProduct: values => ({
      ...baseProduct(values.name, values.brand, clean(values.category) || 'other'),
      other_specs: { model: clean(values.model), color: clean(values.color), notes: clean(values.notes) },
    }),
  },
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitValues(value) {
  return clean(value) ? value.split(',').map(part => part.trim()).filter(Boolean) : [];
}

function connectionCode(value = '') {
  const connection = value.trim().toLowerCase();
  return connection.startsWith('wireless') ? 'WL' : connection.startsWith('wired') ? 'WR' : '--';
}

function shorten(value = '') {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 14) : '--';
}

function baseProduct(name, brand, category) {
  return {
    product_name: clean(name),
    brand: clean(brand) || 'Unknown',
    category,
    confidence: 1,
    estimated_dimensions: null,
    primary_colors: [],
    materials: [],
    surface_texture: '',
  };
}

export default function GearReceiptScreen({ photoUri, productType, onResults, onBack }) {
  const config = CATEGORY_CONFIG[productType] || CATEGORY_CONFIG.other;
  const previewSource = photoUri ? { uri: photoUri } : (CATEGORY_IMAGES[productType] || CATEGORY_IMAGES.other);
  const [values, setValues] = useState({});
  const [showSavedReceipt, setShowSavedReceipt] = useState(false);
  const [itemNo] = useState(() => String(1000 + Math.floor(Math.random() * 9000)));

  const updateValue = (key, value) => setValues(previous => ({ ...previous, [key]: value }));

  const toggleChip = (field, value) => {
    if (!field.multiple) {
      updateValue(field.key, values[field.key] === value ? '' : value);
      return;
    }

    const selected = splitValues(values[field.key]);
    const next = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
    updateValue(field.key, next.join(', '));
  };

  const validate = () => {
    const missing = config.fields.find(field => field.required && !clean(values[field.key]));
    if (missing) {
      Alert.alert(`${titleCase(missing.label)} needed`, `Add the ${missing.label.toLowerCase()} before saving.`);
      return false;
    }
    if (config.requireAny && !config.requireAny.some(key => clean(values[key]))) {
      Alert.alert('Add a component', 'Add at least a case, CPU, or GPU before saving.');
      return false;
    }
    return true;
  };

  const previewReceipt = () => {
    if (validate()) setShowSavedReceipt(true);
  };

  const confirmSave = () => {
    setShowSavedReceipt(false);
    onResults(config.buildProduct(values), photoUri);
  };

  const filledCount = config.fields.filter(field => clean(values[field.key])).length;

  const renderReceipt = readOnly => (
    <View style={styles.receipt}>
      <Zig dir="up" />
      <View style={styles.receiptBody}>
        <Text style={styles.rTitle}>MY SETUP</Text>
        <Text style={styles.rSubtitle}>GEAR RECEIPT · 2026</Text>

        <View style={styles.rMetaRow}>
          <Text style={styles.rMeta}>ITEM #: {itemNo}</Text>
          <Text style={styles.rMeta}>{config.label}</Text>
        </View>

        <DashedLine />
        <Text style={styles.rSection}>— SPECIFICATIONS —</Text>

        {config.fields.map((field, index) => {
          const { key: fieldKey, ...receiptRowProps } = field;
          return (
            <View key={fieldKey}>
              <ReceiptRow
                {...receiptRowProps}
                value={values[fieldKey] || ''}
                onChangeText={value => updateValue(fieldKey, value)}
                readOnly={readOnly}
                last={index === config.fields.length - 1}
              />
              {!readOnly && field.chips && (
                <View style={styles.receiptChipRow}>
                  {field.chips.map(value => {
                    const selected = field.multiple
                      ? splitValues(values[fieldKey]).includes(value)
                      : values[fieldKey] === value;
                    return (
                      <QuickChip
                        key={value}
                        label={`${value}${field.chipSuffix || ''}`}
                        selected={selected}
                        onPress={() => toggleChip(field, value)}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <DashedLine />
        <View style={styles.rMetaRow}>
          <Text style={styles.rLoggedLabel}>DETAILS LOGGED</Text>
          <Text style={styles.rLoggedVal}>{filledCount} / {config.fields.length}</Text>
        </View>
        <DashedLine />

        <Text style={styles.rStars}>✦    ✦    ✦    ✦</Text>
        <Text style={styles.rFooter}>SAVED TO YOUR SETUP</Text>
        <Text style={styles.rFooterSub}>KEEP THIS RECEIPT FOR YOUR RECORDS</Text>
        <Barcode />
        <Text style={styles.rBarcodeText}>{itemNo} · {config.barcode(values)}</Text>
      </View>
      <Zig dir="down" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={previewSource} style={styles.preview} resizeMode="cover" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.retakeButton}>
            <Text style={styles.retakeText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.receiptAvoiding}>
        <ScrollView
          style={styles.receiptScroller}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.receiptScroll}
        >
          {renderReceipt(false)}
          <TouchableOpacity style={styles.receiptSaveBtn} onPress={previewReceipt} activeOpacity={0.85}>
            <Text style={styles.receiptSaveText}>save to my setup</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showSavedReceipt} transparent animationType="slide" onRequestClose={() => setShowSavedReceipt(false)}>
        <View style={styles.savedOverlay}>
          <View style={styles.savedTopBar}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setShowSavedReceipt(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.8}
            >
              <Text style={styles.retakeText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.savedScroll} showsVerticalScrollIndicator={false}>
            {renderReceipt(true)}
            <TouchableOpacity style={styles.savedDoneBtn} onPress={confirmSave} activeOpacity={0.85}>
              <Text style={styles.savedDoneText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function titleCase(value) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function QuickChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity style={[styles.quickChip, selected && styles.quickChipSelected]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.quickChipText, selected && styles.quickChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReceiptRow({ label, optional, value, onChangeText, placeholder, suffix, last, readOnly, chips, chipSuffix, multiple, required, ...inputProps }) {
  return (
    <View style={[styles.rRow, last && styles.rRowLast]}>
      <Text style={styles.rRowLabel}>
        {label}{optional ? <Text style={styles.rOpt}> (OPT)</Text> : null}
      </Text>
      <View style={styles.rValueWrap}>
        {readOnly ? (
          <Text style={[styles.rInput, styles.rValueRO, !clean(value) && styles.rInputEmpty]} numberOfLines={1}>
            {clean(value) ? `${value}${suffix ? ` ${suffix}` : ''}` : '—'}
          </Text>
        ) : (
          <>
            <TextInput
              style={[styles.rInput, !value && styles.rInputEmpty]}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder || 'tap to add'}
              placeholderTextColor="#B8AF9A"
              autoCapitalize="words"
              autoCorrect={false}
              textAlign="right"
              {...inputProps}
            />
            {suffix && clean(value) ? <Text style={styles.rSuffix}> {suffix}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

function DashedLine() {
  return <Text style={styles.dashedLine} numberOfLines={1}>{'- '.repeat(40)}</Text>;
}

function Barcode() {
  return (
    <View style={styles.barcode}>
      {BARCODE_BARS.map((width, index) => (
        <View key={index} style={{ width, height: 46, backgroundColor: '#2B271E', marginRight: 2 }} />
      ))}
    </View>
  );
}

const ZIG_TEETH = Array.from({ length: 20 });
function Zig({ dir }) {
  return (
    <View style={styles.zigRow}>
      {ZIG_TEETH.map((_, index) => (
        <View key={index} style={dir === 'up' ? styles.toothUp : styles.toothDown} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: { height: 330, backgroundColor: '#111111' },
  preview: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, paddingTop: 56, paddingHorizontal: 20 },
  retakeButton: { backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, alignSelf: 'flex-start' },
  retakeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  receiptAvoiding: { flex: 1, marginTop: -8 },
  receiptScroller: { flex: 1 },
  receiptScroll: { flexGrow: 1, paddingBottom: 40 },
  receipt: {
    alignSelf: 'stretch',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  receiptBody: { backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingVertical: 20 },
  rTitle: { fontFamily: mono, fontSize: 21, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 6 },
  rSubtitle: { fontFamily: mono, fontSize: 10.5, color: '#8C846F', textAlign: 'center', letterSpacing: 2, marginTop: 4 },
  rMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  rMeta: { fontFamily: mono, fontSize: 10.5, color: '#8C846F', letterSpacing: 1 },
  rSection: { fontFamily: mono, fontSize: 12, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginVertical: 4 },
  rRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#CFC6B0', borderStyle: 'dashed',
  },
  rRowLast: { borderBottomWidth: 0 },
  receiptChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 2 },
  rRowLabel: { maxWidth: '48%', fontFamily: mono, fontSize: 12.5, fontWeight: '700', color: '#2B271E', letterSpacing: 1 },
  rOpt: { fontSize: 9, color: '#8C846F', fontWeight: '700' },
  rValueWrap: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
  rInput: { flex: 1, fontFamily: mono, fontSize: 13, color: '#2B271E', padding: 0, margin: 0, minWidth: 60 },
  rValueRO: { textAlign: 'right' },
  rInputEmpty: { fontStyle: 'italic', color: '#B8AF9A' },
  rSuffix: { fontFamily: mono, fontSize: 13, color: '#2B271E' },
  dashedLine: { fontFamily: mono, fontSize: 12, color: '#B8AF9A', marginVertical: 8 },
  rLoggedLabel: { fontFamily: mono, fontSize: 12.5, fontWeight: '700', color: '#2B271E', letterSpacing: 1 },
  rLoggedVal: { fontFamily: mono, fontSize: 13, fontWeight: '700', color: '#2B271E' },
  rStars: { textAlign: 'center', color: '#8C846F', fontSize: 12, letterSpacing: 2, marginTop: 12 },
  rFooter: { fontFamily: mono, fontSize: 12, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginTop: 8 },
  rFooterSub: { fontFamily: mono, fontSize: 9, color: '#8C846F', textAlign: 'center', letterSpacing: 1, marginTop: 4 },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: 16 },
  rBarcodeText: { fontFamily: mono, fontSize: 11, color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginTop: 6 },
  zigRow: { height: 9, flexDirection: 'row', overflow: 'hidden' },
  toothUp: {
    width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFFFFF',
  },
  toothDown: {
    width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
  },
  quickChip: {
    minHeight: 36, paddingHorizontal: 13, borderRadius: 18,
    backgroundColor: '#F2F0EA', borderWidth: 1, borderColor: '#D8D2C3',
    alignItems: 'center', justifyContent: 'center',
  },
  quickChipSelected: { backgroundColor: '#161616', borderColor: '#161616' },
  quickChipText: { color: '#6E685A', fontSize: 12, fontWeight: '600' },
  quickChipTextSelected: { color: '#FFFFFF' },
  receiptSaveBtn: { marginTop: 22, marginHorizontal: 20, backgroundColor: '#F2F0EA', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  receiptSaveText: { color: '#1A1A1A', fontSize: 15, fontWeight: '600' },
  savedOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  savedTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, paddingTop: 56, paddingHorizontal: 20 },
  savedScroll: { paddingHorizontal: 24, paddingTop: 112, paddingBottom: 48 },
  savedDoneBtn: { marginTop: 20, marginHorizontal: 20, backgroundColor: '#161616', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  savedDoneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
