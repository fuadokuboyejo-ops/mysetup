import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { setIsPremium } from '../config/setup';

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const MASCOT_INTRO = require('../assets/paywall.gif');
const MASCOT_LOOP = require('../assets/paywall_loop.gif');
const SUBSCREEN_GIF = require('../assets/subscreen.gif');

const INTRO_DURATION_MS = 5700; // paywall.gif is 5900ms — start fade 200ms before end
const CROSSFADE_MS = 200;
const SUBSCREEN_DURATION_MS = 5900; // subscreen.gif's full run time — freeze on its last frame here
const THANKS_DELAY_MS = 400; // let the frozen frame land before the message + button fade in

const FEATURES = [
  { text: 'Save and share your favorite looks', free: true },
  { text: 'Photorealistic renders of your board' },
  { text: 'Preview new gear on your setup instantly' },
  { text: 'Room for up to 100 items in your library' },
  { text: '100 AI generations a month' },
];

const PLANS = {
  yearly: { label: 'Yearly', price: '$39.99', period: '/year', sub: '$3.33/mo', save: 'Save 33%', trial: '3-day free trial, then $39.99/year' },
  monthly: { label: 'Monthly', price: '$4.99', period: '/mo', sub: null, save: null, trial: '$4.99/mo, cancel any time' },
};

function CompareRow({ text, free, isLast }) {
  return (
    <View style={[styles.compareRow, isLast && styles.compareRowLast]}>
      <Text style={styles.compareFeatureText}>{text}</Text>
      <View style={styles.compareCellFree}>
        {free ? (
          <View style={styles.checkCircleFree}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        ) : (
          <Text style={styles.lockIcon}>🔒</Text>
        )}
      </View>
      <View style={styles.compareCellPlus}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
      </View>
    </View>
  );
}

function PlanCard({ id, plan, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.planCardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {plan.save && (
        <View style={styles.saveBadge}>
          <Text style={styles.saveBadgeText}>{plan.save}</Text>
        </View>
      )}
      <View style={styles.planTop}>
        <Text style={styles.planLabel}>{plan.label}</Text>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
      </View>
      <Text style={styles.planPrice}>
        {plan.price}<Text style={styles.planPeriod}>{plan.period}</Text>
      </Text>
      {plan.sub && <Text style={styles.planSub}>{plan.sub}</Text>}
    </TouchableOpacity>
  );
}

export default function RevampPaywallScreen({ onUnlock, onBack }) {
  const [selected, setSelected] = useState('yearly');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const plan = PLANS[selected];
  const introOpacity = useRef(new Animated.Value(1)).current;
  const starPop = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const starTwinkle = useRef([0, 1, 2, 3].map(() => new Animated.Value(1))).current;
  const subscreenRef = useRef(null);
  const thanksOpacity = useRef(new Animated.Value(0)).current;
  const thanksTranslate = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: CROSSFADE_MS,
        useNativeDriver: true,
      }).start();
    }, INTRO_DURATION_MS);

    // The mascot's face blushes pink partway through the intro gif — pop in
    // little stars around the pricing card one by one, then let them twinkle.
    const starTimer = setTimeout(() => {
      Animated.stagger(180, starPop.map(a => Animated.spring(a, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }))).start(() => {
        starTwinkle.forEach((a, i) => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(a, { toValue: 0.35, duration: 650 + i * 140, useNativeDriver: true }),
              Animated.timing(a, { toValue: 1, duration: 650 + i * 140, useNativeDriver: true }),
            ]),
          ).start();
        });
      });
    }, INTRO_DURATION_MS);

    return () => { clearTimeout(t); clearTimeout(starTimer); };
  }, []);

  const starStyle = i => ({
    opacity: Animated.multiply(starPop[i], starTwinkle[i]),
    transform: [{ scale: starPop[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  });

  const unlock = async () => {
    setLoading(true);
    await setIsPremium(true);
    setLoading(false);
    setCelebrating(true);

    // Let the gif play through once, then freeze it on its last frame for
    // good (no auto-continue) — the user taps Continue to move on.
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

  const restore = () => {
    Alert.alert('Restore Subscription', 'No active subscription found for this account.');
  };

  if (celebrating) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Image ref={subscreenRef} source={SUBSCREEN_GIF} style={StyleSheet.absoluteFill} contentFit="cover" autoplay />
        <SafeAreaView style={styles.celebrateSafe} pointerEvents="box-none">
          <Animated.View
            style={[styles.thanksBlock, { opacity: thanksOpacity, transform: [{ translateY: thanksTranslate }] }]}
            pointerEvents="none"
          >
            <View style={styles.thanksBadge}>
              <Text style={styles.thanksBadgeText}>✓  SUBSCRIPTION ACTIVE</Text>
            </View>
            <Text style={styles.thanksTitle}>Thanks for buying!</Text>
          </Animated.View>
          <Animated.View style={[styles.celebrateCtaWrap, { opacity: thanksOpacity }]}>
            <TouchableOpacity style={styles.cta} onPress={onUnlock} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Text style={styles.headerBack}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.mascotWrap}>
            <Image source={MASCOT_LOOP} style={styles.mascot} contentFit="contain" autoplay />
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: introOpacity }]}>
              <Image source={MASCOT_INTRO} style={styles.mascot} contentFit="contain" autoplay />
            </Animated.View>
          </View>
        </View>

        <View style={styles.bottomBlock}>
          <Text style={styles.title}>Access all of AI Revamp</Text>

          <View style={styles.compareCard}>
            <View style={styles.plusColumnBg} />
            <View style={styles.compareHeaderRow}>
              <Text style={styles.compareTitle}>What you get</Text>
              <Text style={styles.compareColLabelFree}>Free</Text>
              <View style={styles.plusColHeader}>
                <View style={styles.plusPillBadge}>
                  <Text style={styles.plusPillText}>Plus</Text>
                </View>
              </View>
            </View>
            {FEATURES.map((f, i) => (
              <CompareRow key={f.text} text={f.text} free={f.free} isLast={i === FEATURES.length - 1} />
            ))}
          </View>

          <View style={styles.pricingWrap}>
            <Animated.Text style={[styles.star, styles.starTL, starStyle(0)]}>✦</Animated.Text>
            <Animated.Text style={[styles.star, styles.starTR, starStyle(1)]}>✧</Animated.Text>
            <Animated.Text style={[styles.star, styles.starR, starStyle(2)]}>✦</Animated.Text>
            <Animated.Text style={[styles.star, styles.starL, starStyle(3)]}>✧</Animated.Text>

            <View style={styles.pricingCard}>
              <View style={styles.plans}>
                <PlanCard id="yearly" plan={PLANS.yearly} selected={selected === 'yearly'} onPress={() => setSelected('yearly')} />
                <PlanCard id="monthly" plan={PLANS.monthly} selected={selected === 'monthly'} onPress={() => setSelected('monthly')} />
              </View>

              {selected === 'yearly' && <Text style={styles.nothingDue}>Nothing due today</Text>}

              <TouchableOpacity style={styles.cta} onPress={unlock} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Continue</Text>}
              </TouchableOpacity>

              <Text style={styles.trialText}>{plan.trial}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={restore} activeOpacity={0.7}>
            <Text style={styles.restore}>Restore Subscription</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#F8F6F2',
  ink: '#161616',
  body: '#6E6E73',
  purple: '#6D5EF0',
  purpleTint: '#EEEBFB',
  border: '#E7E4DB',
  green: '#2FA84F',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  headerBack: { color: C.purple, fontSize: 16, fontWeight: '600' },

  hero: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 120, overflow: 'hidden' },
  bottomBlock: { width: '100%', paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' },
  mascotWrap: { width: 340, height: 340 * (499 / 800), alignItems: 'center', justifyContent: 'center' },
  mascot: { width: '100%', height: '100%' },

  title: { color: C.ink, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 20 },

  compareCard: { width: '100%', marginBottom: 24, position: 'relative', paddingBottom: 4 },
  plusColumnBg: {
    position: 'absolute', top: 18, bottom: 4, right: 0, width: 56,
    backgroundColor: C.purpleTint, borderRadius: 16,
  },
  compareHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  compareTitle: { flex: 1, color: C.ink, fontSize: 16, fontWeight: '700' },
  compareColLabelFree: { width: 56, textAlign: 'center', color: C.body, fontSize: 12, fontWeight: '600' },
  plusColHeader: { width: 56, alignItems: 'center' },
  plusPillBadge: { backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  plusPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  compareRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  compareRowLast: {},
  compareFeatureText: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '500', paddingRight: 8 },
  compareCellFree: { width: 56, alignItems: 'center' },
  lockIcon: { fontSize: 14, opacity: 0.35 },
  compareCellPlus: { width: 56, alignItems: 'center' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleFree: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { color: '#fff', fontSize: 12, fontWeight: '700' },

  pricingWrap: { width: '100%', position: 'relative' },
  pricingCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 24,
    borderWidth: 1.5, borderColor: '#DCD6F7',
    padding: 16, paddingTop: 22, marginBottom: 16,
  },
  star: { position: 'absolute', fontSize: 20, color: C.purple, zIndex: 2 },
  starTL: { top: -14, left: 24 },
  starTR: { top: -18, right: 40, fontSize: 14 },
  starR: { top: '35%', right: -14, fontSize: 16 },
  starL: { top: '55%', left: -12, fontSize: 13 },
  plans: { width: '100%', flexDirection: 'row', gap: 10, marginBottom: 14 },
  planCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
    padding: 14, position: 'relative',
  },
  planCardSelected: { borderColor: C.purple },
  saveBadge: {
    position: 'absolute', top: -11, left: 12,
    backgroundColor: C.purple, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  saveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  planLabel: { color: C.ink, fontSize: 14, fontWeight: '600' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: C.purple },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.purple },
  planPrice: { color: C.ink, fontSize: 20, fontWeight: '700' },
  planPeriod: { fontSize: 13, fontWeight: '500', color: C.body },
  planSub: { color: C.body, fontSize: 12, marginTop: 2 },

  nothingDue: { color: C.green, fontSize: 13, fontWeight: '700', marginBottom: 14 },

  cta: { width: '100%', backgroundColor: C.purple, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  trialText: { color: C.body, fontSize: 12, textAlign: 'center', marginTop: 12 },
  restore: { color: C.purple, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },

  celebrateSafe: {
    flex: 1, justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24,
  },
  thanksBlock: { alignItems: 'center', gap: 12 },
  thanksBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  thanksBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  thanksTitle: {
    color: '#fff', fontFamily: serif, fontSize: 32, fontWeight: '600', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  celebrateCtaWrap: { width: '100%' },
});
