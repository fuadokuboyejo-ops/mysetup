import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TOTAL_SLIDES = 8;
const ACTIVE_INDEX = 5;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const SETUP_OPTIONS = [
  { id: 'pc',      label: 'PC setup',      sub: 'desktop tower, monitors, keyboard.' },
  { id: 'laptop',  label: 'laptop setup',  sub: 'laptop-first, docked or portable.' },
  { id: 'console', label: 'console setup', sub: 'PS5, Xbox, Switch — TV or monitor.' },
  { id: 'homelab', label: 'homelab',       sub: 'rack, servers, NAS, network gear.' },
  { id: 'other',   label: 'other',         sub: 'something else — tell us later.' },
];

function Dots() {
  return (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
        <View key={i} style={[styles.dot, i === ACTIVE_INDEX && styles.dotActive]} />
      ))}
    </View>
  );
}

export default function OnboardingSetupTypeScreen({ onContinue, onBack }) {
  const [selected, setSelected] = useState(new Set());

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Dots />
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>YOUR INTERESTS</Text>
          <Text style={styles.title}>what setups are you interested in?</Text>
          <Text style={styles.subtitle}>this decides what content you see.</Text>

          <View style={styles.optionsList}>
            {SETUP_OPTIONS.map((opt) => {
              const active = selected.has(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionCard, active && styles.optionCardActive]}
                  onPress={() => toggle(opt.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.optionSub, active && styles.optionSubActive]}>
                      {opt.sub}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, active && styles.chevronActive]}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, selected.size === 0 && styles.ctaDisabled]}
            onPress={() => selected.size > 0 && onContinue({ setupTypes: [...selected] })}
            activeOpacity={selected.size > 0 ? 0.85 : 1}
          >
            <Text style={[styles.ctaText, selected.size === 0 && styles.ctaTextDisabled]}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg:       '#FFFFFF',
  ink:      '#161616',
  body:     '#6E6E73',
  purple:   '#6D5EF0',
  purpleTint:'#EEEBFB',
  border:   '#E7E4DB',
  card:     '#F6F6F6',
  dotOff:   '#B8B4AB',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: C.ink, fontSize: 24, fontWeight: '400', marginTop: -2, marginLeft: -2 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.dotOff },
  dotActive: { width: 20, backgroundColor: C.ink },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },

  eyebrow: { color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  title: { color: C.ink, fontFamily: serif, fontSize: 32, lineHeight: 40, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: C.body, fontSize: 15, lineHeight: 22, marginBottom: 28 },

  optionsList: { gap: 10 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'transparent',
    paddingVertical: 18, paddingHorizontal: 18,
  },
  optionCardActive: {
    backgroundColor: C.purpleTint,
    borderColor: C.purple,
  },
  optionText: { flex: 1 },
  optionLabel: { color: C.ink, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  optionLabelActive: { color: C.purple },
  optionSub: { color: C.body, fontSize: 13 },
  optionSubActive: { color: C.purple, opacity: 0.75 },
  chevron: { color: C.body, fontSize: 22, marginLeft: 12 },
  chevronActive: { color: C.purple },

  footer: { paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12 },
  cta: { backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaDisabled: { backgroundColor: '#E0E0E0' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaTextDisabled: { color: '#AAAAAA' },
});
