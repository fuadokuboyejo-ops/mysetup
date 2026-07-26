import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TUTORIAL_STEPS } from '../config/tutorial';

// Dev-only navigation hub — jump straight to any screen while building.
// Reached from the floating "DEV" button (rendered only when __DEV__).
// Screens marked ⚠ depend on runtime data (a loaded setup, a captured photo);
// App.devNavigate seeds a setup for the setup/board/revamp ones, but camera /
// picker / preview still expect a capture flow and may look empty.
const GROUPS = [
  { title: 'Main', screens: ['home', 'profile', 'settings', 'search'] },
  {
    title: 'Onboarding',
    screens: [
      'onboarding', 'onboarding-intro', 'onboarding-board', 'onboarding-camera',
      'onboarding-ai-revamp', 'onboarding-setup-type', 'onboarding-style',
      'onboarding-account', 'onboarding-founder', 'onboarding-build-setup',
      'onboarding-profile', 'onboarding-trial',
    ],
  },
  { title: 'Setup flow', screens: ['setup', 'board-builder', 'picker', 'camera', 'preview'] },
  { title: 'Revamp', screens: ['revamp-menu', 'revamp-setup-picker', 'revamp-camera-roll', 'revamp', 'revamp-paywall'] },
];

const NEEDS_DATA = new Set(['setup', 'board-builder', 'camera', 'picker', 'preview', 'revamp', 'revamp-camera-roll']);

export default function DevScreen({ onNavigate, onStartStep, onClose }) {
  return (
    <View style={S.root}>
      <SafeAreaView style={S.safe} edges={['top']}>
        <View style={S.header}>
          <Text style={S.title}>DEV · screens</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={S.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          {GROUPS.map(group => (
            <View key={group.title} style={S.group}>
              <Text style={S.groupTitle}>{group.title}</Text>
              <View style={S.grid}>
                {group.screens.map(key => (
                  <TouchableOpacity key={key} style={S.btn} onPress={() => onNavigate(key)} activeOpacity={0.75}>
                    <Text style={S.btnText}>{key}{NEEDS_DATA.has(key) ? ' ⚠' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Jump to any tutorial step — routes to its screen and arms the step. */}
          {onStartStep && (
            <View style={S.group}>
              <Text style={S.groupTitle}>Tutorial · jump to step</Text>
              <View style={S.grid}>
                {TUTORIAL_STEPS.map((step, i) => (
                  <TouchableOpacity key={step.id} style={[S.btn, S.stepBtn]} onPress={() => onStartStep(step.id)} activeOpacity={0.75}>
                    <Text style={S.btnText}>{i + 1}. {step.id}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text style={S.footer}>⚠ needs a loaded setup / capture — may be empty. Tutorial steps route to their screen and arm the step; some (cutout-reveal, camera/receipt) need live capture state.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0E12' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#23232B',
  },
  title: { color: '#8AE234', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  close: { color: '#9A9AA6', fontSize: 20, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 40 },
  group: { marginBottom: 22 },
  groupTitle: { color: '#6E6E7A', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    backgroundColor: '#1A1A22', borderWidth: 1, borderColor: '#2C2C36',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
  },
  btnText: { color: '#E6E6EC', fontSize: 13, fontWeight: '600' },
  stepBtn: { borderColor: '#3A3A2C', backgroundColor: '#1C1C14' },
  footer: { color: '#5C5C68', fontSize: 12, marginTop: 4 },
});
