import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { getProOfferings, purchasePackage, restorePurchases } from '../config/purchases';

const HERO = require('../assets/onboarding_trial_hero.png');
const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const FEATURES = [
  'Create photorealistic setup revamps',
  'Save and compare your favorite looks',
  'Keep up to 100 items in your gear library',
];

export default function OnboardingTrialScreen({ onUnlock, onClose }) {
  const insets = useSafeAreaInsets();
  const [annualPackage, setAnnualPackage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getProOfferings().then(offering => {
      if (!active || !offering) return;
      const annual = offering.availablePackages?.find(pkg => pkg.packageType === 'ANNUAL') || null;
      setAnnualPackage(annual);
    });
    return () => { active = false; };
  }, []);

  const price = annualPackage?.product?.priceString || '$39.99';

  const startTrial = async () => {
    if (!annualPackage) {
      Alert.alert('Unavailable', 'Subscriptions are still loading. Please try again in a moment.');
      return;
    }
    setLoading(true);
    const { unlocked, cancelled, error } = await purchasePackage(annualPackage);
    setLoading(false);
    if (cancelled) return;
    if (error) {
      Alert.alert('Purchase failed', error);
      return;
    }
    if (unlocked) onUnlock?.();
  };

  const restore = async () => {
    setLoading(true);
    const { unlocked, error } = await restorePurchases();
    setLoading(false);
    if (unlocked) {
      onUnlock?.();
      return;
    }
    Alert.alert('Restore Subscription', error || 'No active subscription was found.');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity
          style={[styles.close, { top: insets.top + 8 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Image source={HERO} style={styles.hero} contentFit="contain" />

          <Text style={styles.title}>Build your dream setup</Text>

          <View style={styles.featureCard}>
            {FEATURES.map(feature => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.check}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <View style={styles.offer}>
            <Text style={styles.offerText}>
              <Text style={styles.offerStrong}>3 days free</Text>, then {price}/year
            </Text>

            <TouchableOpacity
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={startTrial}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.ink} />
                : <Text style={styles.ctaText}>Start free trial</Text>}
            </TouchableOpacity>

            <Text style={styles.cancelText}>Cancel anytime</Text>
          </View>

          <TouchableOpacity onPress={restore} disabled={loading} activeOpacity={0.65}>
            <Text style={styles.restore}>Restore subscription</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#F4EEE8',
  ink: '#151515',
  body: '#595652',
  teal: '#9ECFD0',
  tealDark: '#4D8E91',
  card: '#FFFDF9',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  close: {
    position: 'absolute',
    right: 18,
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: C.body, fontSize: 28, lineHeight: 30, fontWeight: '300' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  hero: { width: '100%', height: 205, marginBottom: 2 },
  title: {
    maxWidth: 310,
    color: C.ink,
    fontFamily: serif,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  featureCard: {
    width: '100%',
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.ink,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 13,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: C.ink, fontSize: 12, fontWeight: '800' },
  featureText: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  offer: { width: '100%', marginTop: 'auto', paddingTop: 28, alignItems: 'center' },
  offerText: { color: C.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 14 },
  offerStrong: { color: C.ink, fontWeight: '700' },
  cta: {
    width: '100%',
    backgroundColor: C.teal,
    borderWidth: 1.5,
    borderColor: C.ink,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 2,
  },
  ctaDisabled: { opacity: 0.65 },
  ctaText: { color: C.ink, fontSize: 16, fontWeight: '800' },
  cancelText: { color: C.body, fontSize: 12, marginTop: 10 },
  restore: {
    color: C.tealDark,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
    paddingTop: 14,
    paddingHorizontal: 12,
  },
});
