import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Image, Animated, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { getGenerationsUsed, getGenerationHistory, GENERATIONS_LIMIT } from '../config/setup';

const RING_SIZE = 60;
const RING_STROKE = 6;

function GenRing({ used, limit }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, used / limit);
  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r}
          stroke="#ECECEE" strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r}
          stroke="#6D5EF0" strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${c}, ${c}`}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringLabelText}>{used}/{limit}</Text>
      </View>
    </View>
  );
}

const OPTIONS = [
  {
    key: 'scratch',
    image: require('../assets/pencil_airevamp.png'),
    title: 'Design from scratch',
    body: 'Build a brand new board and let AI generate a photo of it.',
  },
  {
    key: 'different-gear',
    image: require('../assets/camera_airevamp.png'),
    title: 'Try different gear',
    body: 'See how your setup would look with different gear.',
  },
  {
    key: 'existing-setup',
    image: require('../assets/folder_airevamp.png'),
    title: 'Generate an existing setup',
    body: 'Turn one of your saved setups into a photorealistic photo.',
  },
];

function OptionCard({ image, title, body, onPress }) {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.cardHardShadow} />
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardBody} numberOfLines={2}>{body}</Text>
        </View>
        <View style={styles.cardArt}>
          <Image source={image} style={styles.cardArtImage} resizeMode="contain" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function RevampMenuScreen({ onBack, onDesignFromScratch, onDifferentGear, onExistingSetup }) {
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [history, setHistory] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const statTranslate = useRef(new Animated.Value(500)).current;
  const statOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(OPTIONS.map(() => new Animated.Value(60))).current;
  const cardOpacity = useRef(OPTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    getGenerationsUsed().then(setGenerationsUsed);
    getGenerationHistory().then(setHistory).catch(() => {});
    Animated.parallel([
      Animated.spring(statTranslate, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(statOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
    Animated.stagger(100, OPTIONS.map((_, i) => Animated.parallel([
      Animated.spring(cardTranslate[i], { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOpacity[i], { toValue: 1, duration: 300, useNativeDriver: true }),
    ]))).start();
  }, []);

  const handlers = {
    scratch: onDesignFromScratch,
    'different-gear': onDifferentGear,
    'existing-setup': onExistingSetup,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>AI Revamp</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>What do you want to do?</Text>

          <View style={styles.list}>
            {OPTIONS.map((o, i) => (
              <Animated.View
                key={o.key}
                style={{ opacity: cardOpacity[i], transform: [{ translateY: cardTranslate[i] }] }}
              >
                <OptionCard image={o.image} title={o.title} body={o.body} onPress={handlers[o.key]} />
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Animated.View
        style={[
          styles.statSheetWrap,
          { opacity: statOpacity, transform: [{ translateY: statTranslate }] },
        ]}
      >
        <View style={styles.statSheetHardShadow} />
        <TouchableOpacity
          style={styles.statSheet}
          activeOpacity={0.8}
          onPress={() => history[0] && setPreviewImage(history[0].image)}
        >
          <View style={styles.statSheetRow}>
            <View style={styles.statInfo}>
              <Text style={styles.statEyebrow}>AI GENERATIONS</Text>
              <Text style={styles.statHeadline}>{generationsUsed} of {GENERATIONS_LIMIT} used</Text>
              <Text style={styles.statSub}>{Math.max(0, GENERATIONS_LIMIT - generationsUsed)} left this month</Text>
            </View>
            <GenRing used={generationsUsed} limit={GENERATIONS_LIMIT} />
          </View>

          {history.length > 0 ? (
            <>
              <Text style={styles.historyLabel}>RECENT GENERATIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
                {history.map(h => (
                  <TouchableOpacity key={h.id} onPress={() => setPreviewImage(h.image)} activeOpacity={0.85}>
                    <Image source={{ uri: `data:image/jpeg;base64,${h.image}` }} style={styles.historyThumb} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={styles.historyEmpty}>
              <Text style={styles.historyEmptyText}>Your generated photos will show up here.</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewImage(null)}>
          <Image source={{ uri: `data:image/jpeg;base64,${previewImage}` }} style={styles.previewFullImage} resizeMode="contain" />
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const C = { bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#8A8792', purple: '#6D5EF0', purpleTint: '#EEEBFB' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 28, fontWeight: '300' },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },

  body: { paddingBottom: 360 },
  sub: { color: C.sub, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 },

  list: { paddingHorizontal: 20, gap: 16 },

  // Fixed panel anchored to the bottom of the screen, styled like the option
  // cards above it (black border + hard offset shadow, no blur).
  statSheetWrap: {
    position: 'absolute', left: 20, right: 20, bottom: 20,
    minHeight: 340,
  },
  statSheetHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 16,
  },
  statSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#161616',
    paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20,
    overflow: 'hidden',
  },
  statSheetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  statInfo: { flex: 1, gap: 3 },

  historyLabel: { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 24, marginBottom: 10 },
  historyRow: { gap: 10 },
  historyThumb: {
    width: 72, height: 72, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#161616',
    backgroundColor: '#F0EFEA',
  },
  historyEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  historyEmptyText: { color: C.sub, fontSize: 13, textAlign: 'center' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  previewFullImage: { width: '100%', aspectRatio: 1, borderRadius: 14 },
  statEyebrow: { color: C.purple, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  statHeadline: { color: C.text, fontSize: 16, fontWeight: '700' },
  statSub: { color: C.sub, fontSize: 12.5 },

  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringLabelText: { color: C.text, fontSize: 11, fontWeight: '700' },

  // Hard (unblurred) drop shadow — a solid offset shape behind the card,
  // matching ProductPickerScreen's category cards.
  cardWrap: { position: 'relative' },
  cardHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#161616',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  cardInfo: { flex: 1, gap: 3, paddingVertical: 16, paddingLeft: 16, paddingRight: 8, justifyContent: 'center' },
  cardTitle: { color: '#161616', fontSize: 15, fontWeight: '700' },
  cardBody: { color: '#8A8792', fontSize: 12, lineHeight: 16 },
  cardArt: {
    width: 120, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cardArtImage: { width: '100%', height: 82 },
});
