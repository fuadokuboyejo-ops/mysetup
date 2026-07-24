import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { getProOfferings, purchasePackage, restorePurchases } from '../config/purchases';

const SUBSCREEN_GIF = require('../assets/subscreen.gif');
const HERO_IMAGE = require('../assets/revamp_paywall_hero.png');
const SUBSCREEN_DURATION_MS = 5900;
const THANKS_DELAY_MS = 400;

const FEATURES = [
  { text: 'Save and share your favorite looks', free: true },
  { text: 'Photorealistic renders of your board' },
  { text: 'Room for up to 100 items in your library' },
  { text: '100 AI generations a month' },
];

const PLANS = {
  yearly: {
    label: 'Yearly',
    price: '$39.99',
    period: '/year',
    sub: '$3.33/mo',
    save: 'Save 33%',
    trial: '3-day free trial, then $39.99/year',
  },
  monthly: {
    label: 'Monthly',
    price: '$4.99',
    period: '/mo',
    sub: '3 days free',
    trial: '3-day free trial, then $4.99/month',
  },
};

function Check({ muted = false }) {
  return (
    <View style={[styles.check, muted && styles.checkMuted]}>
      <Text style={styles.checkText}>✓</Text>
    </View>
  );
}

function CompareRow({ text, free, isLast }) {
  return (
    <View style={[styles.compareRow, isLast && styles.compareRowLast]}>
      <Text style={styles.compareFeatureText}>{text}</Text>
      <View style={styles.compareCell}>
        {free ? <Check muted /> : <Text style={styles.dash}>—</Text>}
      </View>
      <View style={styles.compareCell}>
        <Check />
      </View>
    </View>
  );
}

function PlanCard({ plan, selected, onPress }) {
  return (
    <View style={[styles.planShadow, selected && styles.planShadowSelected]}>
      <TouchableOpacity
        style={[styles.planCard, selected && styles.planCardSelected]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        {plan.save ? (
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>{plan.save}</Text>
          </View>
        ) : null}

        <View style={styles.planTop}>
          <Text style={styles.planLabel}>{plan.label}</Text>
          <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        </View>

        <Text style={styles.planPrice}>
          {plan.price}
          <Text style={styles.planPeriod}>{plan.period}</Text>
        </Text>
        <Text style={styles.planSub}>{plan.sub}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RevampPaywallScreen({ onUnlock, onBack }) {
  const [selected, setSelected] = useState('yearly');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [packages, setPackages] = useState({ yearly: null, monthly: null });

  const subscreenRef = useRef(null);
  const thanksOpacity = useRef(new Animated.Value(0)).current;
  const thanksTranslate = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    let active = true;
    getProOfferings().then(offering => {
      if (!active || !offering) return;
      const byType = { yearly: null, monthly: null };
      for (const pkg of offering.availablePackages || []) {
        if (pkg.packageType === 'ANNUAL') byType.yearly = pkg;
        if (pkg.packageType === 'MONTHLY') byType.monthly = pkg;
      }
      setPackages(byType);
    });
    return () => { active = false; };
  }, []);

  const displayPlans = {
    yearly: packages.yearly
      ? {
          ...PLANS.yearly,
          price: packages.yearly.product.priceString,
          trial: `3-day free trial, then ${packages.yearly.product.priceString}/year`,
        }
      : PLANS.yearly,
    monthly: packages.monthly
      ? {
          ...PLANS.monthly,
          price: packages.monthly.product.priceString,
          trial: `3-day free trial, then ${packages.monthly.product.priceString}/month`,
        }
      : PLANS.monthly,
  };
  const plan = displayPlans[selected];

  const unlock = async () => {
    const pkg = packages[selected];
    if (!pkg) {
      Alert.alert('Unavailable', 'Subscriptions aren’t available right now — please try again in a moment.');
      return;
    }

    setLoading(true);
    const { unlocked, cancelled, error } = await purchasePackage(pkg);
    setLoading(false);

    if (cancelled) return;
    if (error) {
      Alert.alert('Purchase failed', error);
      return;
    }
    if (!unlocked) {
      Alert.alert('Almost there', 'Your purchase didn’t activate Pro. Try “Restore Subscription”.');
      return;
    }

    setCelebrating(true);
    setTimeout(() => {
      subscreenRef.current?.stopAnimating();
      Animated.parallel([
        Animated.timing(thanksOpacity, {
          toValue: 1,
          duration: 400,
          delay: THANKS_DELAY_MS,
          useNativeDriver: true,
        }),
        Animated.spring(thanksTranslate, {
          toValue: 0,
          friction: 7,
          delay: THANKS_DELAY_MS,
          useNativeDriver: true,
        }),
      ]).start();
    }, SUBSCREEN_DURATION_MS);
  };

  const restore = async () => {
    setLoading(true);
    const { unlocked, error } = await restorePurchases();
    setLoading(false);
    if (unlocked) {
      onUnlock?.();
      return;
    }
    Alert.alert('Restore Subscription', error || 'No active subscription found for this account.');
  };

  if (celebrating) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Image
          ref={subscreenRef}
          source={SUBSCREEN_GIF}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          autoplay
        />
        <SafeAreaView style={styles.celebrateSafe} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.thanksBlock,
              { opacity: thanksOpacity, transform: [{ translateY: thanksTranslate }] },
            ]}
            pointerEvents="none"
          >
            <View style={styles.thanksBadge}>
              <Text style={styles.thanksBadgeText}>✓  SUBSCRIPTION ACTIVE</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.celebrateCtaWrap, { opacity: thanksOpacity }]}>
            <TouchableOpacity style={styles.celebrateButton} onPress={onUnlock} activeOpacity={0.85}>
              <Text style={styles.celebrateButtonText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
          >
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.hero}>
            <Image source={HERO_IMAGE} style={styles.heroImage} contentFit="contain" />
          </View>

          <Text style={styles.title}>Access all of AI Revamp</Text>
          <Text style={styles.subtitle}>Build more ideas and see your dream setup come to life.</Text>

          <Text style={styles.sectionLabel}>WHAT YOU GET</Text>
          <View style={styles.cardShadow}>
            <View style={styles.compareCard}>
              <View style={styles.compareHeaderRow}>
                <View style={styles.compareHeading}>
                  <Text style={styles.compareTitle}>AI Revamp access</Text>
                  <Text style={styles.compareCaption}>Everything you need to keep creating</Text>
                </View>
                <Text style={styles.compareColLabel}>FREE</Text>
                <View style={styles.plusBadge}>
                  <Text style={styles.plusBadgeText}>PLUS</Text>
                </View>
              </View>

              {FEATURES.map((feature, index) => (
                <CompareRow
                  key={feature.text}
                  text={feature.text}
                  free={feature.free}
                  isLast={index === FEATURES.length - 1}
                />
              ))}
            </View>
          </View>

          <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
          <View style={styles.plans}>
            <PlanCard
              plan={displayPlans.yearly}
              selected={selected === 'yearly'}
              onPress={() => setSelected('yearly')}
            />
            <PlanCard
              plan={displayPlans.monthly}
              selected={selected === 'monthly'}
              onPress={() => setSelected('monthly')}
            />
          </View>

          <View style={styles.dueRow}>
            <View style={styles.dueDot} />
            <Text style={styles.nothingDue}>Nothing due today</Text>
          </View>

          <View style={styles.ctaShadow}>
            <TouchableOpacity
              style={styles.cta}
              onPress={unlock}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.ink} />
                : <Text style={styles.ctaText}>Start free trial</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.trialText}>{plan.trial}</Text>

          <TouchableOpacity onPress={restore} disabled={loading} activeOpacity={0.7}>
            <Text style={styles.restore}>Restore Subscription</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#FFFFFF',
  ink: '#19181A',
  body: '#8B8791',
  purple: '#655D75',
  purpleBright: '#6557F5',
  purpleTint: '#F0EEFF',
  border: '#202024',
  muted: '#ECECEF',
  teal: '#9BDCE7',
  green: '#418B72',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 10, paddingBottom: 28 },

  header: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: C.ink,
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '300',
  },
  hero: {
    width: '100%',
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 2,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },

  title: {
    color: C.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  subtitle: {
    color: C.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#9893A0',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 10,
    marginBottom: 8,
  },

  cardShadow: {
    width: '100%',
    backgroundColor: C.purple,
    borderRadius: 17,
    paddingBottom: 4,
    paddingRight: 3,
  },
  compareCard: {
    width: '100%',
    backgroundColor: C.bg,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  compareHeaderRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  compareHeading: { flex: 1, paddingRight: 6 },
  compareTitle: {
    color: C.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  compareCaption: {
    color: C.body,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
  compareColLabel: {
    width: 48,
    textAlign: 'center',
    color: C.body,
    fontSize: 9,
    fontWeight: '800',
  },
  plusBadge: {
    width: 48,
    backgroundColor: C.purpleTint,
    borderRadius: 12,
    paddingVertical: 5,
    alignItems: 'center',
  },
  plusBadgeText: {
    color: C.purpleBright,
    fontSize: 9,
    fontWeight: '900',
  },
  compareRow: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E6EA',
  },
  compareRowLast: { borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
  compareFeatureText: {
    flex: 1,
    color: C.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    paddingRight: 6,
  },
  compareCell: { width: 48, alignItems: 'center' },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6EAAB4',
  },
  checkMuted: { backgroundColor: '#D9D8DD', borderColor: '#B5B2BA' },
  checkText: { color: C.ink, fontSize: 10, fontWeight: '900' },
  dash: { color: '#B9B6BD', fontSize: 15 },

  plans: { width: '100%', flexDirection: 'row', gap: 10 },
  planShadow: {
    flex: 1,
    borderRadius: 15,
    paddingBottom: 3,
    paddingRight: 2,
    backgroundColor: '#D8D6DD',
  },
  planShadowSelected: { backgroundColor: C.purple },
  planCard: {
    minHeight: 115,
    backgroundColor: C.bg,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  planCardSelected: { backgroundColor: '#FCFBFF' },
  saveBadge: {
    position: 'absolute',
    top: -10,
    left: 10,
    backgroundColor: C.purpleBright,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  saveBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  planLabel: { color: C.ink, fontSize: 13, fontWeight: '800' },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#AAA7AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: C.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.ink },
  planPrice: { color: C.ink, fontSize: 18, fontWeight: '900' },
  planPeriod: { color: C.body, fontSize: 10, fontWeight: '600' },
  planSub: { color: C.body, fontSize: 10, lineHeight: 14, marginTop: 3 },

  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },
  dueDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green,
    marginRight: 6,
  },
  nothingDue: { color: C.green, fontSize: 11, fontWeight: '800' },

  ctaShadow: {
    width: '100%',
    backgroundColor: C.purple,
    borderRadius: 24,
    paddingBottom: 4,
    paddingRight: 2,
    marginTop: 13,
  },
  cta: {
    width: '100%',
    minHeight: 48,
    backgroundColor: C.teal,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: C.ink, fontSize: 14, fontWeight: '900' },
  trialText: {
    color: C.body,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  restore: {
    color: C.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: 15,
  },

  celebrateSafe: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  thanksBlock: { alignItems: 'center' },
  thanksBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  thanksBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  celebrateCtaWrap: { width: '100%' },
  celebrateButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: C.purpleBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrateButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
