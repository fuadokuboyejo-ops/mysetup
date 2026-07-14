import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SCAN_ENDPOINT } from '../config/api';

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

  return (
    <View style={styles.container}>
      <Image source={{ uri: photoUri }} style={[styles.preview, manualEntry && styles.keyboardPreview]} resizeMode="contain" />

      <View style={[styles.overlay, manualEntry && styles.keyboardOverlay]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onRetake} style={styles.retakeButton} disabled={scanning}>
            <Text style={styles.retakeText}>← Retake</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={manualEntry && styles.keyboardAvoiding}>
          <View style={[styles.bottomPanel, manualEntry && styles.keyboardPanel]}>
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
                contentContainerStyle={styles.keyboardPanelContent}
              >
                <Text style={styles.panelTitle}>Mouse details</Text>
                <Text style={styles.panelSub}>Add the specs yourself before saving.</Text>

                <View style={styles.manualCard}>
                  <Field label="Brand" value={mouseBrand} onChangeText={setMouseBrand} placeholder="Logitech, Razer, Pulsar..." />
                  <Field label="Model" value={mouseModel} onChangeText={setMouseModel} placeholder="G Pro X Superlight, Viper V2..." />

                  <View style={styles.fieldGroup}>
                    <Field label="Weight (g)" value={mouseWeight} onChangeText={setMouseWeight} placeholder="63" keyboardType="numbers-and-punctuation" />
                    <View style={styles.chipRow}>
                      {['45', '55', '63', '75', '90'].map(value => (
                        <QuickChip key={value} label={`${value}g`} selected={mouseWeight === value} onPress={() => setMouseWeight(value)} />
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Field label="Connection (optional)" value={mouseConnection} onChangeText={setMouseConnection} placeholder="Wireless" />
                    <View style={styles.chipRow}>
                      {['Wireless', 'Wired'].map(value => (
                        <QuickChip key={value} label={value} selected={mouseConnection === value} onPress={() => setMouseConnection(value)} />
                      ))}
                    </View>
                  </View>

                  <Field label="DPI (optional)" value={mouseDpi} onChangeText={setMouseDpi} placeholder="26000" keyboardType="numbers-and-punctuation" />
                  <Field label="Polling rate (optional)" value={mousePolling} onChangeText={setMousePolling} placeholder="1000 Hz, 8000 Hz..." />
                  <Field label="Sensor (optional)" value={mouseSensor} onChangeText={setMouseSensor} placeholder="HERO 2, Focus Pro 30K..." />
                </View>

                <TouchableOpacity style={[styles.analyzeButton, styles.keyboardSaveButton]} onPress={saveMouseDetails} activeOpacity={0.85}>
                  <Text style={[styles.analyzeText, styles.keyboardSaveButtonText]}>Save Mouse Details</Text>
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

function QuickChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.quickChip, selected && styles.quickChipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.quickChipText, selected && styles.quickChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
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
});
