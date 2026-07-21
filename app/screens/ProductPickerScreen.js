import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle } from 'react-native-svg';
import { getAllItems } from '../config/setup';
import { TutorialMultiSpotlight } from '../components/TutorialOverlay';
import { TUTORIAL_STEPS, useTutorialStep, advanceTutorial, jumpTutorial, skipTutorial } from '../config/tutorial';

export const PRODUCT_GUIDES = {
  mouse:      { label: 'Mouse',     tip: 'side profile so the shape reads',      outline: 'portrait',  guide: 'Side profile so the shape reads. Steady, well-lit.' },
  monitor:    { label: 'Monitor',   tip: 'shoot straight-on, screen off',        outline: 'landscape', guide: 'Straight-on, screen off, fill the frame. Avoids glare & keystone.' },
  keyboard:   { label: 'Keyboard',  tip: 'top-down, slight tilt to show keys',   outline: 'landscape', guide: 'Top-down, slight tilt to show keys, on a plain surface.' },
  pc_tower:   { label: 'PC Tower',  tip: 'front 3/4 angle to show side panel',   outline: 'portrait',  guide: 'Front 3/4 angle to show the side panel & RGB.' },
  server:     { label: 'Server',    tip: 'front 3/4 angle to show drive bays',   outline: 'landscape', guide: 'Front 3/4 angle to show the drive bays & ports. Even, glare-free light.' },
  laptop:     { label: 'Laptop',    tip: 'open ~120°, front 3/4 angle',          outline: 'landscape', guide: 'Open the lid ~120° and shoot from a front 3/4 angle so the screen & keyboard both show.' },
  console:    { label: 'Console',   tip: 'front 3/4 angle, plain surface',       outline: 'landscape', guide: 'Front 3/4 angle on a plain surface so the shape & front ports read clearly.' },
  deskmat:    { label: 'Desk Mat',  tip: 'top-down, show the full mat',           outline: 'landscape', guide: 'Top-down shot, show the full mat on a plain desk.' },
  other:      { label: 'Other',     tip: 'center the item, good lighting',        outline: 'square',    guide: 'Center the item against a plain background with good lighting.' },
};

const PRODUCT_IMAGES = {
  mouse: require('../assets/mouse_pic.png'),
  monitor: require('../assets/monitor_pic.png'),
  keyboard: require('../assets/keyboard_pic.png'),
  pc_tower: require('../assets/pc_pic.png'),
  server: require('../assets/server.png'),
  laptop: require('../assets/laptop.png'),
  console: require('../assets/consle.png'),
  deskmat: require('../assets/mousepad_pic.png'),
  other: require('../assets/other_pic.png'),
};

// Zoom (crop-to-fill) instead of full-frame contain — these photos have
// generous margin around the product, so cropping in makes it read bigger.
const COVER_KEYS = new Set(['monitor', 'pc_tower', 'other']);

const FREE_LIMIT = 10;
const PREMIUM_LIMIT = 100;
const RING_SIZE = 60;
const RING_STROKE = 6;

function PhotoRing({ used, limit }) {
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
          stroke="#161616" strokeWidth={RING_STROKE} fill="none"
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

export default function ProductPickerScreen({ onSelect, onBack, onGoToLibrary, onPhotoPicked, isPremium, onRequirePremium }) {
  const products = Object.entries(PRODUCT_GUIDES);
  const [photoCount, setPhotoCount] = useState(0);
  // Photo picked from the gallery, awaiting a category before we can proceed —
  // camera-roll photos have no guide step, so we ask "what is this?" instead.
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
  const atCap = photoCount >= limit;
  const pickStep = useTutorialStep('pick-category');
  const tutorialNodes = useRef(new Map());
  const tutorialMeasureQueued = useRef(false);
  const tutorialScrollY = useRef(new Animated.Value(0)).current;
  const [tutorialRects, setTutorialRects] = useState([]);
  // The photo count arrives async and reflows the page, so the tutorial waits
  // for it before measuring — until then the overlay shows the loading screen.
  const [itemsLoaded, setItemsLoaded] = useState(false);
  // Bottom edge of the fixed header, in window coords — the overlay clips its
  // scrolling cutouts to the area below it.
  const [tutorialViewportTop, setTutorialViewportTop] = useState(0);
  const headerRef = useRef(null);
  const measureHeader = useCallback(() => {
    headerRef.current?.measureInWindow?.((x, y, width, height) => {
      if (height > 0) setTutorialViewportTop(y + height);
    });
  }, []);

  const registerTutorialNode = useCallback((key, node) => {
    if (node) tutorialNodes.current.set(key, node);
    else tutorialNodes.current.delete(key);
  }, []);

  const measureTutorialTargets = useCallback(() => {
    // Wait for the item count to land first — it reflows the page, and measuring
    // before that yields oversized cutouts that leave the screen looking undimmed.
    if (!itemsLoaded || !pickStep.active || pendingPhoto || tutorialMeasureQueued.current) return;
    tutorialMeasureQueued.current = true;
    requestAnimationFrame(() => {
      tutorialMeasureQueued.current = false;
      const entries = [...tutorialNodes.current.entries()].filter(([, node]) => node?.measureInWindow);
      if (!entries.length) return;
      const measured = [];
      let remaining = entries.length;
      entries.forEach(([key, node]) => {
        node.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) measured.push({ key, x, y, width, height });
          remaining -= 1;
          if (remaining === 0) {
            setTutorialRects(measured);
          }
        });
      });
    });
  }, [itemsLoaded, pendingPhoto, pickStep.active]);

  useEffect(() => {
    if (!itemsLoaded || !pickStep.active || pendingPhoto) {
      setTutorialRects([]);
      return undefined;
    }
    // Data has landed, so the layout is final — measure now, with a couple of
    // quick retries in case measureInWindow still reports 0s on the first pass.
    const timers = [0, 80, 220, 500].map(ms => setTimeout(measureTutorialTargets, ms));
    return () => timers.forEach(clearTimeout);
  }, [itemsLoaded, measureTutorialTargets, pendingPhoto, pickStep.active]);
  // Entrance animation: stat card, gallery tile, then each category — staggered.
  const sectionCount = 2 + products.length;
  const sectionTranslate = useRef(Array.from({ length: sectionCount }, () => new Animated.Value(60))).current;
  const sectionOpacity = useRef(Array.from({ length: sectionCount }, () => new Animated.Value(0))).current;

  useEffect(() => {
    getAllItems()
      .then(items => setPhotoCount(items.length))
      .catch(() => {})
      // Either way the page is settled — release the tutorial's loading cover.
      .finally(() => setItemsLoaded(true));
    Animated.stagger(90, sectionTranslate.map((_, i) => Animated.parallel([
      Animated.spring(sectionTranslate[i], { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(sectionOpacity[i], { toValue: 1, duration: 300, useNativeDriver: true }),
    ]))).start();
  }, []);

  const blockAtCap = () => {
    if (isPremium) {
      Alert.alert('Library full', `You've reached the ${PREMIUM_LIMIT}-item limit.`);
    } else {
      onRequirePremium?.();
    }
  };

  const pickFromCameraRoll = async () => {
    if (atCap) { blockAtCap(); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const handleCategoryPress = (key, product) => {
    advanceTutorial('pick-category'); // no-op unless the tutorial is on this step
    if (pendingPhoto) {
      // Camera-roll photos go straight to the receipt — no camera screen — so
      // skip the shutter step too, or the tutorial stalls waiting for it.
      jumpTutorial('receipt-save');
      onPhotoPicked?.(pendingPhoto.uri, pendingPhoto.base64, key, product);
      setPendingPhoto(null);
    } else if (atCap) {
      blockAtCap();
    } else {
      onSelect(key, product);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header} ref={headerRef} onLayout={measureHeader}>
        <TouchableOpacity onPress={pendingPhoto ? () => setPendingPhoto(null) : onBack} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{pendingPhoto ? 'What did you photograph?' : 'What are you scanning?'}</Text>
        <Text style={styles.subtitle}>
          {pendingPhoto ? 'Pick a category for this photo' : "We'll guide you on how to photograph it"}
        </Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onScroll={pickStep.active ? Animated.event(
          [{ nativeEvent: { contentOffset: { y: tutorialScrollY } } }],
          { useNativeDriver: true },
        ) : undefined}
        scrollEventThrottle={16}
      >
        {pendingPhoto ? (
          <View style={styles.pendingWrap}>
            <View style={styles.pendingHardShadow} />
            <Image source={{ uri: pendingPhoto.uri }} style={styles.pendingImage} resizeMode="cover" />
          </View>
        ) : (
          <>
            <Animated.View
              style={[
                styles.statWrap,
                {
                  opacity: pickStep.active ? 1 : sectionOpacity[0],
                  transform: [{ translateY: pickStep.active ? 0 : sectionTranslate[0] }],
                },
              ]}
            >
              <View style={styles.statHardShadow} />
              <View style={styles.statCard}>
                <View style={styles.statInfo}>
                  <Text style={styles.statEyebrow}>PHOTO LIBRARY</Text>
                  <Text style={styles.statHeadline}>{photoCount} of {limit} photos used</Text>
                  <Text style={styles.statSub}>
                    {isPremium
                      ? `${Math.max(0, limit - photoCount)} left`
                      : `${Math.max(0, limit - photoCount)} left — Plus unlocks up to ${PREMIUM_LIMIT}`}
                  </Text>
                  <TouchableOpacity style={styles.libraryBtn} onPress={onGoToLibrary} activeOpacity={0.8}>
                    <Text style={styles.libraryBtnText}>Go to library</Text>
                  </TouchableOpacity>
                </View>
                <PhotoRing used={photoCount} limit={limit} />
              </View>
            </Animated.View>

            <Text style={styles.sectionLabel}>ADD FROM CAMERA ROLL</Text>
            <View style={styles.galleryRow}>
              <Animated.View
                ref={node => registerTutorialNode('camera-roll', node)}
                onLayout={measureTutorialTargets}
                style={[
                  styles.galleryWrap,
                  {
                    opacity: pickStep.active ? 1 : sectionOpacity[1],
                    transform: [{ translateY: pickStep.active ? 0 : sectionTranslate[1] }],
                  },
                ]}
              >
                <View style={styles.galleryHardShadow} />
                <TouchableOpacity style={styles.galleryTile} onPress={pickFromCameraRoll} activeOpacity={0.8}>
                  <Image source={require('../assets/cameraroll_pic.png')} style={styles.galleryImage} resizeMode="contain" />
                  <Text style={styles.galleryLabel}>Camera roll</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}

        <View
          ref={node => registerTutorialNode('categories-section', node)}
          onLayout={measureTutorialTargets}
        >
          <Text style={styles.sectionLabel}>CATEGORIES</Text>
          <View style={styles.list}>
            {products.map(([key, product], i) => {
              const image = PRODUCT_IMAGES[key];
              const idx = 2 + i;
              return (
                <Animated.View
                  key={key}
                  style={[
                    styles.itemWrap,
                    {
                      opacity: pickStep.active ? 1 : sectionOpacity[idx],
                      transform: [{ translateY: pickStep.active ? 0 : sectionTranslate[idx] }],
                    },
                  ]}
                >
                  <View style={styles.itemHardShadow} />
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => handleCategoryPress(key, product)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemLabel}>{product.label}</Text>
                      <Text style={styles.itemGuide} numberOfLines={2}>{product.guide}</Text>
                    </View>
                    <View style={styles.itemArt}>
                      <Image
                        source={image}
                        style={styles.itemArtImage}
                        resizeMode={COVER_KEYS.has(key) ? 'cover' : 'contain'}
                      />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Rendered the moment the step is active — the overlay dims instantly
          (before measurement) and punches the spotlight cutouts in once the
          targets are measured, so the plain page never flashes. */}
      {pickStep.active && !pendingPhoto && (
        <TutorialMultiSpotlight
          steps={TUTORIAL_STEPS}
          stepIndex={pickStep.stepIndex}
          targetRects={tutorialRects}
          onSkip={skipTutorial}
          message="add a photo to your gallery"
          coachTargetRect={tutorialRects.find(rect => rect.key === 'camera-roll')}
          scrollOffset={tutorialScrollY}
          viewportTop={tutorialViewportTop}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 6,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDEBF3',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  closeText: { color: '#161616', fontSize: 15, fontWeight: '600' },
  title: { color: '#161616', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#8A8792', fontSize: 14 },

  body: { paddingHorizontal: 16, paddingBottom: 40 },

  pendingWrap: { position: 'relative', marginBottom: 24 },
  pendingHardShadow: {
    position: 'absolute',
    top: 4, left: 4, right: -4, bottom: -4,
    backgroundColor: '#615A78',
    borderRadius: 20,
  },
  pendingImage: {
    width: '100%', height: 180,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: '#161616',
  },

  statWrap: { position: 'relative', marginBottom: 24 },
  statHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#161616',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statInfo: { flex: 1, gap: 4 },
  statEyebrow: { color: '#6D5EF0', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  statHeadline: { color: '#161616', fontSize: 16, fontWeight: '700' },
  statSub: { color: '#8A8792', fontSize: 12.5 },
  libraryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#8FD4E8',
    borderWidth: 1.5, borderColor: '#161616',
    borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    marginTop: 6,
  },
  libraryBtnText: { color: '#0E3A47', fontSize: 12.5, fontWeight: '700' },

  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringLabelText: { color: '#161616', fontSize: 11, fontWeight: '700' },

  sectionLabel: {
    color: '#8A8792', fontSize: 12, fontWeight: '700', letterSpacing: 0.8,
    marginBottom: 10, marginLeft: 2,
  },

  galleryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  galleryWrap: { position: 'relative', width: '31%' },
  galleryHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 16,
  },
  galleryTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#161616',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 10,
  },
  galleryImage: { width: '72%', height: '58%' },
  galleryLabel: { color: '#161616', fontSize: 12, fontWeight: '700' },

  list: { gap: 12 },

  // Hard (unblurred) drop shadow — a solid offset shape behind the card,
  // not a soft shadowRadius blur. Classic pop-art / comic sticker look.
  itemWrap: { position: 'relative' },
  itemHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 16,
  },

  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#161616',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  itemInfo: { flex: 1, gap: 1, paddingVertical: 14, paddingLeft: 14, paddingRight: 8, justifyContent: 'center' },
  itemLabel: { color: '#161616', fontSize: 13, fontWeight: '700' },
  itemGuide: { color: '#8A8792', fontSize: 10, lineHeight: 13 },

  itemArt: {
    width: 150, height: 82, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  itemArtImage: { width: '100%', height: '100%' },
});
