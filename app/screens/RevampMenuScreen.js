import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Image, Animated, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { getGenerationsUsed, getGenerationHistory, getSetups, GENERATIONS_LIMIT, SETUP_TYPES } from '../config/setup';

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

const GEAR_OPTIONS = [
  {
    key: 'camera-roll',
    image: require('../assets/desk_airevamp.png'),
    title: 'Get photo from camera roll',
    body: 'Pick an existing photo.',
  },
  {
    key: 'take-photo',
    image: require('../assets/chair_airevamp.png'),
    title: 'Take photo of setup',
    body: 'Snap a fresh photo now.',
  },
  {
    key: 'from-setup',
    image: require('../assets/iem_airevamp.png'),
    title: 'Select photo from current setup',
    body: 'Use a photo from one of your saved setups.',
  },
];

// Same white-card + black-border + hard-offset-shadow treatment as OptionCard
// above, sized down for the bottom-sheet chooser rows.
function GearOptionCard({ image, title, body, onPress }) {
  return (
    <View style={styles.gearCardWrap}>
      <View style={styles.gearCardHardShadow} />
      <TouchableOpacity style={styles.gearCard} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.gearCardInfo}>
          <Text style={styles.gearCardTitle}>{title}</Text>
          <Text style={styles.gearCardBody}>{body}</Text>
        </View>
        <View style={styles.gearCardArt}>
          <Image source={image} style={styles.gearCardArtImage} resizeMode="contain" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function RevampMenuScreen({ onBack, onDesignFromScratch, onDifferentGear, onCameraRoll, onExistingSetup }) {
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [history, setHistory] = useState([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Photo-source chooser for "Try different gear": null (closed) → 'menu'
  // (the three source options) → 'setups' (pick one of your saved setups).
  const [gearMode, setGearMode] = useState(null);
  const [photoSetups, setPhotoSetups] = useState([]);
  // "Design from scratch" first asks what kind of setup to build, mirroring the
  // Profile "New Setup" flow. null = closed; otherwise the selected type key.
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [scratchType, setScratchType] = useState('');
  const [historyWidth, setHistoryWidth] = useState(0);
  const statTranslate = useRef(new Animated.Value(500)).current;
  const statOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(OPTIONS.map(() => new Animated.Value(60))).current;
  const cardOpacity = useRef(OPTIONS.map(() => new Animated.Value(0))).current;
  const gearCardTranslate = useRef(GEAR_OPTIONS.map(() => new Animated.Value(40))).current;
  const gearCardOpacity = useRef(GEAR_OPTIONS.map(() => new Animated.Value(0))).current;

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

  // Staggered fade + slide-up for the gear chooser cards, replayed each time
  // the three-option menu is shown (first open, and coming back from 'setups').
  const animateGearCards = () => {
    gearCardTranslate.forEach(v => v.setValue(40));
    gearCardOpacity.forEach(v => v.setValue(0));
    Animated.stagger(90, GEAR_OPTIONS.map((_, i) => Animated.parallel([
      Animated.spring(gearCardTranslate[i], { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(gearCardOpacity[i], { toValue: 1, duration: 280, useNativeDriver: true }),
    ]))).start();
  };

  // "Try different gear" starts from a photo of the user's setup — open the
  // source chooser rather than jumping straight into the revamp screen.
  const openGearSheet = async () => {
    setGearMode('menu');
    animateGearCards();
    try {
      const sts = await getSetups();
      setPhotoSetups(sts.filter(s => s.photo));
    } catch { setPhotoSetups([]); }
  };

  const finishGear = (photo) => {
    setGearMode(null);
    onDifferentGear(photo);
  };

  const takePhotoOfSetup = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5, base64: true, allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      finishGear({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const openTypePicker = () => { setScratchType(''); setTypePickerOpen(true); };

  const confirmScratchType = () => {
    if (!scratchType) return;
    setTypePickerOpen(false);
    onDesignFromScratch(scratchType);
  };

  const handlers = {
    scratch: openTypePicker,
    'different-gear': openGearSheet,
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

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
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
                <View onLayout={e => setHistoryWidth(e.nativeEvent.layout.width)}>
                  <Text style={styles.historyLabel}>RECENT GENERATIONS</Text>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.historyRow}
                  >
                    {history.map(h => (
                      <TouchableOpacity
                        key={h.id}
                        onPress={() => setGalleryOpen(true)}
                        activeOpacity={0.9}
                        style={styles.historyThumbWrap}
                      >
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${h.image}` }}
                          style={[styles.historyThumb, historyWidth > 0 && { width: historyWidth }]}
                          resizeMode="cover"
                        />
                        <View style={styles.historyViewAllBtn}>
                          <Text style={styles.historyViewAllBtnText}>View AI Generated Images</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.historyEmpty}>
                  <Text style={styles.historyEmptyText}>Your generated photos will show up here.</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* "Design from scratch" — pick the kind of setup before building */}
      <Modal visible={typePickerOpen} transparent animationType="fade" onRequestClose={() => setTypePickerOpen(false)}>
        <View style={styles.typeOverlay}>
          <View style={styles.typeCard}>
            <Text style={styles.typeTitle}>What kind of setup?</Text>
            <Text style={styles.typeSub}>Choose what you want to design.</Text>
            <View style={styles.typeGrid}>
              {SETUP_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, scratchType === t.key && styles.typeBtnActive]}
                  onPress={() => setScratchType(t.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.typeBtnText, scratchType === t.key && styles.typeBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.typeBtns}>
              <TouchableOpacity style={styles.typeCancelBtn} onPress={() => setTypePickerOpen(false)}>
                <Text style={styles.typeCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeConfirmBtn, !scratchType && styles.typeConfirmBtnDisabled]}
                onPress={confirmScratchType}
                disabled={!scratchType}
              >
                <Text style={styles.typeConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Grid of every past AI generation */}
      <Modal visible={galleryOpen} transparent animationType="slide" onRequestClose={() => setGalleryOpen(false)}>
        <View style={styles.galleryOverlay}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>AI Generated Images</Text>
            <TouchableOpacity onPress={() => setGalleryOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.galleryClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {history.length === 0 ? (
            <View style={styles.galleryEmpty}>
              <Text style={styles.galleryEmptyText}>No AI generated images yet.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.galleryGrid} showsVerticalScrollIndicator={false}>
              {history.map(h => (
                <View key={h.id} style={styles.galleryItem}>
                  <Image source={{ uri: `data:image/jpeg;base64,${h.image}` }} style={styles.galleryItemImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* "Try different gear" photo-source chooser */}
      <Modal visible={gearMode !== null} transparent animationType="slide" onRequestClose={() => setGearMode(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setGearMode(null)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {gearMode === 'menu' ? (
              <>
                <Text style={styles.sheetTitle}>Try different gear</Text>
                <Text style={styles.sheetSub}>Start from a photo of your setup.</Text>

                <View style={styles.gearList}>
                  {GEAR_OPTIONS.map((o, i) => (
                    <Animated.View
                      key={o.key}
                      style={{ opacity: gearCardOpacity[i], transform: [{ translateY: gearCardTranslate[i] }] }}
                    >
                      <GearOptionCard
                        image={o.image}
                        title={o.title}
                        body={o.body}
                        onPress={
                          o.key === 'camera-roll' ? () => { setGearMode(null); onCameraRoll?.(); }
                            : o.key === 'take-photo' ? takePhotoOfSetup
                              : () => setGearMode('setups')
                        }
                      />
                    </Animated.View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Choose a setup photo</Text>
                {photoSetups.length === 0 ? (
                  <Text style={styles.gearEmpty}>None of your saved setups have a photo yet.</Text>
                ) : (
                  <ScrollView style={styles.gearSetupList} showsVerticalScrollIndicator={false}>
                    {photoSetups.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.gearSetupRow}
                        onPress={() => finishGear({ uri: `data:image/jpeg;base64,${s.photo}`, base64: s.photo })}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: `data:image/jpeg;base64,${s.photo}` }} style={styles.gearSetupThumb} resizeMode="cover" />
                        <Text style={styles.gearSetupName} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.gearChevron}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <TouchableOpacity
                  onPress={() => { setGearMode('menu'); animateGearCards(); }}
                  activeOpacity={0.7}
                  style={styles.gearBackBtn}
                >
                  <Text style={styles.gearBack}>‹ Back</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const C = { bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#8A8792', purple: '#6D5EF0', purpleTint: '#EEEBFB' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // "Design from scratch" type picker
  typeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  typeCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '100%', gap: 16, borderWidth: 1, borderColor: C.border },
  typeTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  typeSub: { color: C.sub, fontSize: 14, marginTop: -10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { width: '47%', paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  typeBtnActive: { borderColor: C.purple, backgroundColor: C.purpleTint },
  typeBtnText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: C.purple },
  typeBtns: { flexDirection: 'row', gap: 10 },
  typeCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  typeCancelText: { color: C.sub, fontSize: 15, fontWeight: '700' },
  typeConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.text, alignItems: 'center' },
  typeConfirmBtnDisabled: { backgroundColor: '#D8D8D8' },
  typeConfirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 28, fontWeight: '300' },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },

  body: { paddingBottom: 40 },
  sub: { color: C.sub, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 },

  list: { paddingHorizontal: 20, gap: 16 },

  // Scrolls in with the option cards above it (rather than floating as a
  // fixed overlay) so there's always a real gap, no matter how tall the
  // recent-generation photo makes this card.
  statSheetWrap: {
    marginHorizontal: 20, marginTop: 28,
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
  historyRow: { gap: 12 },
  historyThumbWrap: { position: 'relative' },
  historyThumb: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#161616',
    backgroundColor: '#F0EFEA',
  },
  historyViewAllBtn: {
    position: 'absolute', left: 12, right: 12, bottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1.5, borderColor: '#161616',
    paddingVertical: 12, alignItems: 'center',
  },
  historyViewAllBtnText: { color: '#161616', fontSize: 13.5, fontWeight: '700' },
  historyEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12 },
  historyEmptyText: { color: C.sub, fontSize: 13, textAlign: 'center' },

  // Full-history grid, opened from the single-image preview above.
  galleryOverlay: { flex: 1, backgroundColor: C.bg, paddingTop: 60 },
  galleryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  galleryTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  galleryClose: { color: C.sub, fontSize: 20, fontWeight: '600' },
  galleryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 20, paddingBottom: 40,
  },
  galleryItem: {
    width: '31.3%', aspectRatio: 1, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#161616',
    overflow: 'hidden', backgroundColor: '#F0EFEA',
  },
  galleryItemImage: { width: '100%', height: '100%' },
  galleryEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  galleryEmptyText: { color: C.sub, fontSize: 14, textAlign: 'center' },
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

  // "Try different gear" bottom-sheet chooser
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 12 },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  sheetSub: { color: C.sub, fontSize: 13, marginTop: 3, marginBottom: 12 },

  gearList: { gap: 14, marginTop: 4 },

  // Same white-card + black-border + hard-offset-shadow treatment as the
  // OptionCard above, sized down for the sheet.
  gearCardWrap: { position: 'relative' },
  gearCardHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 14,
  },
  gearCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#161616',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  gearCardInfo: { flex: 1, gap: 2 },
  gearCardTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  gearCardBody: { color: C.sub, fontSize: 12.5, lineHeight: 16 },
  gearCardArt: { width: 76, alignItems: 'center', justifyContent: 'center' },
  gearCardArtImage: { width: '100%', height: 56 },
  gearChevron: { color: C.sub, fontSize: 24, fontWeight: '300' },

  gearEmpty: { color: C.sub, fontSize: 14, textAlign: 'center', paddingVertical: 28 },
  gearSetupList: { maxHeight: 320 },
  gearSetupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  gearSetupThumb: {
    width: 52, height: 52, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#161616', backgroundColor: '#F0EFEA',
  },
  gearSetupName: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600' },
  gearBackBtn: { paddingTop: 16, alignItems: 'center' },
  gearBack: { color: C.purple, fontSize: 15, fontWeight: '700' },
});
