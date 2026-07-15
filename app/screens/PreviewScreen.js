import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native';
import { SCAN_ENDPOINT } from '../config/api';

const mono = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });

// A fixed pattern of bar widths so the barcode looks consistent between renders.
const BARCODE_BARS = [3, 1, 2, 4, 1, 3, 1, 1, 2, 3, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 3, 2, 4, 1, 2, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2];

export default function PreviewScreen({ photoUri, photoBase64, productType, onResults, onRetake }) {
  const [scanning, setScanning] = useState(false);
  const [keyboardName, setKeyboardName] = useState('');
  const [keyboardBrand, setKeyboardBrand] = useState('');
  const [keyboardPercent, setKeyboardPercent] = useState('');
  const [keyboardSwitches, setKeyboardSwitches] = useState('');
  const [keyboardLayout, setKeyboardLayout] = useState('');

  // Monitor manual entry — we don't analyze a screen, we just ask for specs.
  const [monitorModel, setMonitorModel] = useState('');
  const [monitorHz, setMonitorHz] = useState('');
  const [monitorInches, setMonitorInches] = useState('');
  const [monitorResolution, setMonitorResolution] = useState('');
  const [monitorFeatures, setMonitorFeatures] = useState([]);

  // Mouse manual entry — brand + model + weight (+ optional extras).
  const [mouseBrand, setMouseBrand] = useState('');
  const [mouseModel, setMouseModel] = useState('');
  const [mouseWeight, setMouseWeight] = useState('');
  const [mouseDpi, setMouseDpi] = useState('');
  const [mousePolling, setMousePolling] = useState('');
  const [mouseConnection, setMouseConnection] = useState('');
  const [mouseSensor, setMouseSensor] = useState('');
  const [mouseSwitch, setMouseSwitch] = useState('');
  // Receipt "ITEM #", generated once so it stays stable while editing.
  const [itemNo] = useState(() => String(1000 + Math.floor(Math.random() * 9000)));
  const [showSavedReceipt, setShowSavedReceipt] = useState(false);

  // PC build manual entry — we ask for the components, no image analysis.
  const [pcCpu, setPcCpu] = useState('');
  const [pcGpu, setPcGpu] = useState('');
  const [pcPsu, setPcPsu] = useState('');
  const [pcMobo, setPcMobo] = useState('');
  const [pcCase, setPcCase] = useState('');
  const [pcRgb, setPcRgb] = useState('');

  const isKeyboard = productType === 'keyboard';
  const isMonitor = productType === 'monitor';
  const isMouse = productType === 'mouse';
  const isPc = productType === 'pc_tower';
  const manualEntry = isKeyboard || isMonitor || isMouse || isPc;

  const toggleFeature = (f) =>
    setMonitorFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const analyzeSetup = async () => {
    setScanning(true);
    try {
      const response = await fetch(SCAN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photoBase64 }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(`Server error ${response.status}: ${errBody.details || errBody.error || 'unknown'}`);
      }

      const data = await response.json();
      onResults(data.product, photoUri);
    } catch (e) {
      Alert.alert('Scan Failed', e.message, [{ text: 'OK' }]);
    } finally {
      setScanning(false);
    }
  };

  const saveKeyboardDetails = () => {
    const name = keyboardName.trim();
    if (!name) {
      Alert.alert('Name needed', 'Add the keyboard name before saving.');
      return;
    }

    onResults({
      product_name: name,
      brand: keyboardBrand.trim() || 'Unknown',
      category: 'keyboard',
      confidence: 1,
      estimated_dimensions: null,
      primary_colors: [],
      materials: [],
      surface_texture: '',
      keyboard_specs: {
        percentage: keyboardPercent.trim(),
        switches: keyboardSwitches.trim(),
        layout: keyboardLayout.trim(),
      },
    }, photoUri);
  };

  const saveMonitorDetails = () => {
    const model = monitorModel.trim();
    if (!model) {
      Alert.alert('Model needed', 'Add the monitor model before saving.');
      return;
    }

    onResults({
      product_name: model,
      brand: 'Unknown',
      category: 'monitor',
      confidence: 1,
      estimated_dimensions: null,
      primary_colors: [],
      materials: [],
      surface_texture: '',
      monitor_specs: {
        hz: monitorHz.trim(),
        inches: monitorInches.trim(),
        resolution: monitorResolution.trim(),
        features: monitorFeatures,
      },
    }, photoUri);
  };

  const saveMouseDetails = () => {
    const model = mouseModel.trim();
    if (!model) {
      Alert.alert('Model needed', 'Add the mouse model before saving.');
      return;
    }

    onResults({
      product_name: model,
      brand: mouseBrand.trim() || 'Unknown',
      category: 'mouse',
      confidence: 1,
      estimated_dimensions: null,
      primary_colors: [],
      materials: [],
      surface_texture: '',
      mouse_specs: {
        brand: mouseBrand.trim(),
        weight: mouseWeight.trim(),
        dpi: mouseDpi.trim(),
        polling: mousePolling.trim(),
        connection: mouseConnection.trim(),
        sensor: mouseSensor.trim(),
        switches: mouseSwitch.trim(),
      },
    }, photoUri);
  };

  const savePcDetails = () => {
    const cpu = pcCpu.trim();
    const gpu = pcGpu.trim();
    const psu = pcPsu.trim();
    const mobo = pcMobo.trim();
    const pcCaseName = pcCase.trim();

    if (![cpu, gpu, psu, mobo, pcCaseName].some(Boolean)) {
      Alert.alert('Add components', 'Fill in at least one component before saving.');
      return;
    }

    const name = pcCaseName || [cpu, gpu].filter(Boolean).join(' · ') || 'Custom PC';

    onResults({
      product_name: name,
      brand: 'Unknown',
      category: 'pc',
      confidence: 1,
      estimated_dimensions: null,
      primary_colors: [],
      materials: [],
      surface_texture: '',
      pc_specs: {
        cpu,
        gpu,
        psu,
        motherboard: mobo,
        case: pcCaseName,
        rgb: pcRgb.trim(),
      },
    }, photoUri);
  };

  // Receipt summary values (mouse).
  const mouseFilled = [mouseBrand, mouseModel, mouseWeight, mouseConnection, mouseDpi, mouseSwitch]
    .filter(v => v.trim()).length;
  const conn = mouseConnection.trim().toLowerCase();
  const connAbbrev = conn.startsWith('wireless') ? 'WL' : conn.startsWith('wired') ? 'WR' : '--';

  // Tapping "save to my setup" first shows the finished receipt as a
  // confirmation; "Done" on that then actually commits via saveMouseDetails.
  const openSavedReceipt = () => {
    if (!mouseModel.trim()) {
      Alert.alert('Model needed', 'Add the mouse model before saving.');
      return;
    }
    setShowSavedReceipt(true);
  };

  const confirmSaveMouse = () => {
    setShowSavedReceipt(false);
    saveMouseDetails();
  };

  const renderReceipt = (readOnly) => (
    <View style={styles.receipt}>
      <Zig dir="up" />
      <View style={styles.receiptBody}>
        <Text style={styles.rTitle}>MY SETUP</Text>
        <Text style={styles.rSubtitle}>GEAR RECEIPT · 2026</Text>

        <View style={styles.rMetaRow}>
          <Text style={styles.rMeta}>ITEM #: {itemNo}</Text>
          <Text style={styles.rMeta}>MOUSE</Text>
        </View>

        <DashedLine />
        <Text style={styles.rSection}>— SPECIFICATIONS —</Text>

        <ReceiptRow readOnly={readOnly} label="BRAND" value={mouseBrand} onChangeText={setMouseBrand} placeholder="tap to type" />
        <ReceiptRow readOnly={readOnly} label="MODEL" value={mouseModel} onChangeText={setMouseModel} placeholder="tap to type" />
        <ReceiptRow readOnly={readOnly} label="WEIGHT" value={mouseWeight} onChangeText={setMouseWeight} placeholder="tap to type" suffix="g" keyboardType="numbers-and-punctuation" />
        {!readOnly && (
          <View style={styles.receiptChipRow}>
            {['45', '55', '63', '75', '90'].map(value => (
              <QuickChip key={value} label={`${value}g`} selected={mouseWeight === value} onPress={() => setMouseWeight(value)} dark />
            ))}
          </View>
        )}

        <ReceiptRow readOnly={readOnly} label="CONNECTION" optional value={mouseConnection} onChangeText={setMouseConnection} placeholder="tap to type" />
        {!readOnly && (
          <View style={styles.receiptChipRow}>
            {['Wireless', 'Wired'].map(value => (
              <QuickChip key={value} label={value} selected={mouseConnection === value} onPress={() => setMouseConnection(value)} dark />
            ))}
          </View>
        )}

        <ReceiptRow readOnly={readOnly} label="DPI" optional value={mouseDpi} onChangeText={setMouseDpi} placeholder="tap to type" keyboardType="numbers-and-punctuation" />
        <ReceiptRow readOnly={readOnly} label="SWITCH" optional value={mouseSwitch} onChangeText={setMouseSwitch} placeholder="tap to type" last />

        <DashedLine />
        <View style={styles.rMetaRow}>
          <Text style={styles.rLoggedLabel}>ITEMS LOGGED</Text>
          <Text style={styles.rLoggedVal}>{mouseFilled} / 6</Text>
        </View>
        <DashedLine />

        <Text style={styles.rStars}>✦    ✦    ✦    ✦</Text>
        <Text style={styles.rFooter}>SAVED TO YOUR SETUP</Text>
        <Text style={styles.rFooterSub}>KEEP THIS RECEIPT FOR YOUR RECORDS</Text>

        <Barcode />
        <Text style={styles.rBarcodeText}>{itemNo} · {mouseWeight.trim() || '--'}g · {connAbbrev}</Text>
      </View>
      <Zig dir="down" />
    </View>
  );

  return (
    <View style={[styles.container, isMouse && styles.mouseContainer]}>
      <Image
        source={{ uri: photoUri }}
        style={[styles.preview, manualEntry && !isMouse && styles.keyboardPreview, isMouse && styles.mousePreview]}
        resizeMode={isMouse ? 'cover' : 'contain'}
      />

      <View style={[styles.overlay, manualEntry && styles.keyboardOverlay]}>
        <View style={[styles.topBar, isMouse && styles.mouseTopBar]}>
          {!showSavedReceipt && (
            <TouchableOpacity onPress={onRetake} style={styles.retakeButton} disabled={scanning}>
              <Text style={styles.retakeText}>← Retake</Text>
            </TouchableOpacity>
          )}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[manualEntry && styles.keyboardAvoiding, isMouse && styles.mouseAvoiding]}>
          <View style={[styles.bottomPanel, manualEntry && styles.keyboardPanel, isMouse && styles.mousePanel]}>
            {isKeyboard ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.keyboardPanelContent}
              >
                <Text style={styles.panelTitle}>Keyboard details</Text>
                <Text style={styles.panelSub}>Add the specs yourself before saving.</Text>

                <View style={styles.manualCard}>
                  <Field label="Name" value={keyboardName} onChangeText={setKeyboardName} placeholder="Keychron Q1" />
                  <Field label="Brand" value={keyboardBrand} onChangeText={setKeyboardBrand} placeholder="Keychron" />

                  <View style={styles.fieldGroup}>
                    <Field label="Percentage" value={keyboardPercent} onChangeText={setKeyboardPercent} placeholder="75%" keyboardType="numbers-and-punctuation" />
                    <View style={styles.chipRow}>
                      {['60%', '65%', '75%', 'TKL'].map(value => (
                        <QuickChip key={value} label={value} selected={keyboardPercent === value} onPress={() => setKeyboardPercent(value)} />
                      ))}
                    </View>
                  </View>

                  <Field label="Switches" value={keyboardSwitches} onChangeText={setKeyboardSwitches} placeholder="Gateron brown" />

                  <View style={styles.fieldGroup}>
                    <Field label="Layout" value={keyboardLayout} onChangeText={setKeyboardLayout} placeholder="ANSI, ISO, Alice..." />
                    <View style={styles.chipRow}>
                      {['ANSI', 'ISO', 'Alice'].map(value => (
                        <QuickChip key={value} label={value} selected={keyboardLayout === value} onPress={() => setKeyboardLayout(value)} />
                      ))}
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={[styles.analyzeButton, styles.keyboardSaveButton]} onPress={saveKeyboardDetails} activeOpacity={0.85}>
                  <Text style={[styles.analyzeText, styles.keyboardSaveButtonText]}>Save Keyboard Details</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : isMonitor ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.keyboardPanelContent}
              >
                <Text style={styles.panelTitle}>Monitor details</Text>
                <Text style={styles.panelSub}>Add the specs yourself — screens don't scan well.</Text>

                <View style={styles.manualCard}>
                  <Field label="Model" value={monitorModel} onChangeText={setMonitorModel} placeholder="Odyssey G7, UltraGear 27GP..." />

                  <View style={styles.fieldGroup}>
                    <Field label="Refresh rate (Hz)" value={monitorHz} onChangeText={setMonitorHz} placeholder="144" keyboardType="numbers-and-punctuation" />
                    <View style={styles.chipRow}>
                      {['60', '75', '120', '144', '165', '240'].map(value => (
                        <QuickChip key={value} label={`${value}Hz`} selected={monitorHz === value} onPress={() => setMonitorHz(value)} />
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Field label="Size (inches)" value={monitorInches} onChangeText={setMonitorInches} placeholder="27" keyboardType="numbers-and-punctuation" />
                    <View style={styles.chipRow}>
                      {['24', '27', '32', '34', '49'].map(value => (
                        <QuickChip key={value} label={`${value}"`} selected={monitorInches === value} onPress={() => setMonitorInches(value)} />
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Field label="Resolution" value={monitorResolution} onChangeText={setMonitorResolution} placeholder="1440p, 4K, Ultrawide..." />
                    <View style={styles.chipRow}>
                      {['1080p', '1440p', '4K', 'Ultrawide'].map(value => (
                        <QuickChip key={value} label={value} selected={monitorResolution === value} onPress={() => setMonitorResolution(value)} />
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Panel & features</Text>
                    <View style={styles.chipRow}>
                      {['IPS', 'VA', 'OLED', 'QLED', 'Mini-LED', 'HDR', 'Curved', 'RGB'].map(value => (
                        <QuickChip key={value} label={value} selected={monitorFeatures.includes(value)} onPress={() => toggleFeature(value)} />
                      ))}
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={[styles.analyzeButton, styles.keyboardSaveButton]} onPress={saveMonitorDetails} activeOpacity={0.85}>
                  <Text style={[styles.analyzeText, styles.keyboardSaveButtonText]}>Save Monitor Details</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : isMouse ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.receiptScroll}
              >
                {renderReceipt(false)}

                <TouchableOpacity style={styles.receiptSaveBtn} onPress={openSavedReceipt} activeOpacity={0.85}>
                  <Text style={styles.receiptSaveText}>save to my setup</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : isPc ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.keyboardPanelContent}
              >
                <Text style={styles.panelTitle}>PC build</Text>
                <Text style={styles.panelSub}>Add your components before saving.</Text>

                <View style={styles.manualCard}>
                  <Field label="CPU" value={pcCpu} onChangeText={setPcCpu} placeholder="Ryzen 7 7800X3D, i7-14700K..." />
                  <Field label="GPU" value={pcGpu} onChangeText={setPcGpu} placeholder="RTX 4070, RX 7900 XT..." />
                  <Field label="Power supply" value={pcPsu} onChangeText={setPcPsu} placeholder="Corsair RM850x, 850W..." />
                  <Field label="Motherboard" value={pcMobo} onChangeText={setPcMobo} placeholder="B650 Tomahawk, Z790..." />
                  <Field label="Case" value={pcCase} onChangeText={setPcCase} placeholder="Lian Li O11, NR200..." />

                  <View style={styles.fieldGroup}>
                    <Field label="RGB" value={pcRgb} onChangeText={setPcRgb} placeholder="Yes" />
                    <View style={styles.chipRow}>
                      {['Yes', 'No'].map(value => (
                        <QuickChip key={value} label={value} selected={pcRgb === value} onPress={() => setPcRgb(value)} />
                      ))}
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={[styles.analyzeButton, styles.keyboardSaveButton]} onPress={savePcDetails} activeOpacity={0.85}>
                  <Text style={[styles.analyzeText, styles.keyboardSaveButtonText]}>Save PC Build</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <>
                <Text style={styles.panelTitle}>Ready to scan</Text>
                <Text style={styles.panelSub}>We'll identify every item in your setup</Text>

                <TouchableOpacity
                  style={[styles.analyzeButton, scanning && styles.analyzeDisabled]}
                  onPress={analyzeSetup}
                  disabled={scanning}
                  activeOpacity={0.85}
                >
                  {scanning ? (
                    <View style={styles.scanningRow}>
                      <ActivityIndicator color="#0F0F0F" size="small" />
                      <Text style={styles.analyzeText}>Analyzing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.analyzeText}>Analyze Product</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Saved-receipt confirmation */}
      <Modal visible={showSavedReceipt} transparent animationType="slide" onRequestClose={() => setShowSavedReceipt(false)}>
        <View style={styles.savedOverlay}>
          <View style={[styles.savedTopBar, styles.mouseTopBar]}>
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
            <TouchableOpacity style={styles.savedDoneBtn} onPress={confirmSaveMouse} activeOpacity={0.85}>
              <Text style={styles.savedDoneText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#666"
        autoCapitalize="words"
        autoCorrect={false}
      />
    </View>
  );
}

function QuickChip({ label, selected, onPress, dark }) {
  return (
    <TouchableOpacity
      style={[styles.quickChip, selected && (dark ? styles.quickChipSelectedDark : styles.quickChipSelected)]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.quickChipText, selected && styles.quickChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Gear receipt pieces (mouse details) ──────────────────────────────────────
// A spec line on the receipt: label on the left, an inline text field on the
// right that reads like typed receipt text (empty optional rows show a faint
// italic "tap to add").
function ReceiptRow({ label, optional, value, onChangeText, placeholder, suffix, last, readOnly, ...inputProps }) {
  return (
    <View style={[styles.rRow, last && styles.rRowLast]}>
      <Text style={styles.rRowLabel}>
        {label}{optional ? <Text style={styles.rOpt}> (OPT)</Text> : null}
      </Text>
      <View style={styles.rValueWrap}>
        {readOnly ? (
          <Text style={[styles.rInput, styles.rValueRO, !value.trim() && styles.rInputEmpty]} numberOfLines={1}>
            {value.trim() ? `${value}${suffix ? ` ${suffix}` : ''}` : '—'}
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
            {suffix && value.trim() ? <Text style={styles.rSuffix}> {suffix}</Text> : null}
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
      {BARCODE_BARS.map((w, i) => (
        <View key={i} style={{ width: w, height: 46, backgroundColor: '#2B271E', marginRight: 2 }} />
      ))}
    </View>
  );
}

// Torn zigzag edge for the top/bottom of the receipt — a row of paper-coloured
// triangles pointing up (top) or down (bottom).
const ZIG_TEETH = Array.from({ length: 20 });
function Zig({ dir }) {
  return (
    <View style={styles.zigRow}>
      {ZIG_TEETH.map((_, i) => (
        <View key={i} style={dir === 'up' ? styles.toothUp : styles.toothDown} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, width: '100%' },
  keyboardPreview: {
    flex: 0,
    height: 340,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  keyboardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-start',
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  retakeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  retakeText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  keyboardAvoiding: {
    flex: 1,
    marginTop: 150,
  },

  bottomPanel: {
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
    gap: 8,
  },
  keyboardPanel: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 0,
    paddingBottom: 0,
  },
  keyboardPanelContent: {
    padding: 24,
    paddingBottom: 120,
    gap: 8,
  },
  panelTitle: { color: '#161616', fontSize: 20, fontWeight: '700' },
  panelSub: { color: '#8A8792', fontSize: 14, marginBottom: 8 },
  manualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
    gap: 14,
    marginTop: 4,
  },
  fieldGroup: { gap: 10 },
  field: { gap: 7, marginTop: 10 },
  fieldLabel: { color: '#8A8792', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#FAFAF8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#161616',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipSelected: {
    backgroundColor: '#6D5EF0',
    borderColor: '#6D5EF0',
  },
  quickChipSelectedDark: {
    backgroundColor: '#161616',
    borderColor: '#161616',
  },
  quickChipText: { color: '#6E6E73', fontSize: 13, fontWeight: '600' },
  quickChipTextSelected: { color: '#FFFFFF' },

  analyzeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  keyboardSaveButton: { marginBottom: 24, backgroundColor: '#6D5EF0' },
  keyboardSaveButtonText: { color: '#FFFFFF' },
  analyzeDisabled: { opacity: 0.6 },
  analyzeText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // ── Gear receipt (mouse details) ──
  // Cream page behind everything so that below the receipt it reads as paper
  // (not the photo, not black); the photo is a fixed hero pinned to the top.
  mouseContainer: { backgroundColor: '#FFFFFF' },
  mousePreview: { flex: 0, height: 330, width: '100%' },
  mousePanel: { backgroundColor: 'transparent' },
  // Pin the retake bar so it doesn't push the receipt down, then start the
  // receipt just above the photo's bottom edge so the torn top overlaps it.
  mouseTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  mouseAvoiding: { marginTop: 322 },
  receiptScroll: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 40 },
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
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#CFC6B0', borderStyle: 'dashed',
  },
  rRowLast: { borderBottomWidth: 0 },
  receiptChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 2 },
  rRowLabel: { fontFamily: mono, fontSize: 12.5, fontWeight: '700', color: '#2B271E', letterSpacing: 1 },
  rOpt: { fontSize: 9, color: '#8C846F', fontWeight: '700' },
  rValueWrap: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
  rInput: { flex: 1, fontFamily: mono, fontSize: 13, color: '#2B271E', padding: 0, margin: 0 },
  rValueRO: { textAlign: 'right' },
  rInputEmpty: { fontStyle: 'italic', color: '#B8AF9A' },
  rSuffix: { fontFamily: mono, fontSize: 13, color: '#2B271E' },

  dashedLine: { fontFamily: mono, fontSize: 12, color: '#B8AF9A', letterSpacing: 0, marginVertical: 8 },

  rLoggedLabel: { fontFamily: mono, fontSize: 12.5, fontWeight: '700', color: '#2B271E', letterSpacing: 1 },
  rLoggedVal: { fontFamily: mono, fontSize: 13, fontWeight: '700', color: '#2B271E' },

  rStars: { textAlign: 'center', color: '#8C846F', fontSize: 12, letterSpacing: 2, marginTop: 12 },
  rFooter: { fontFamily: mono, fontSize: 12, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginTop: 8 },
  rFooterSub: { fontFamily: mono, fontSize: 9, color: '#8C846F', textAlign: 'center', letterSpacing: 1, marginTop: 4 },

  barcode: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: 16 },
  rBarcodeText: { fontFamily: mono, fontSize: 11, color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginTop: 6 },

  zigRow: { height: 9, flexDirection: 'row', overflow: 'hidden' },
  toothUp: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFFFFF',
  },
  toothDown: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
  },

  receiptSaveBtn: { marginTop: 22, marginHorizontal: 20, backgroundColor: '#F2F0EA', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  receiptSaveText: { color: '#1A1A1A', fontSize: 15, fontWeight: '600' },

  savedOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center' },
  // The Modal already insets content by the safe area, so this needs a much
  // smaller top padding than the raw screen's topBar (56) to visually line up
  // the Back button with where the Retake button sat.
  savedTopBar: { paddingTop: 12, paddingHorizontal: 20 },
  savedScroll: { paddingHorizontal: 24, paddingTop: 100, paddingBottom: 48 },
  savedDoneBtn: { marginTop: 20, marginHorizontal: 20, backgroundColor: '#161616', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  savedDoneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
