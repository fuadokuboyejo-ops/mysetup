import { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, UIManager, LayoutAnimation,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { imageUri } from '../config/media';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A swipeable photo slideshow. Pass `items` — each is either an image
// ({ uri } or { base64 }) or a gradient ({ gradient: [...] }), with an optional
// `overlay` node drawn on top of that slide (e.g. the tagged photo's dots).
//
// Each photo keeps its OWN aspect ratio: the frame resizes to the photo you're
// currently viewing (measured on load) so extra photos aren't cropped to match
// the hero. Every image is 'contain'-fit, and because the frame matches the
// current photo's aspect, it fills edge-to-edge with no letterboxing — while the
// hero's percentage-positioned tags stay aligned.
export default function PhotoCarousel({ items, fallbackAspect = 4 / 3, style }) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [aspects, setAspects] = useState({}); // slide index -> width/height
  const ref = useRef(null);
  const count = items.length;
  const currentAspect = aspects[index] || fallbackAspect;

  const setActive = (i) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setIndex(i);
  };

  const go = (i) => {
    const clamped = Math.max(0, Math.min(count - 1, i));
    if (width > 0) ref.current?.scrollTo({ x: clamped * width, animated: true });
    setActive(clamped);
  };

  const uriFor = (it) => imageUri(it.uri || it.base64);

  return (
    <View
      style={[styles.frame, { aspectRatio: currentAspect }, style]}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={count > 1}
        onMomentumScrollEnd={e => {
          if (width > 0) setActive(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      >
        {items.map((it, i) => {
          const uri = uriFor(it);
          return (
            <View key={i} style={{ width: width || undefined, height: '100%' }}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  onLoad={(e) => {
                    const s = e?.source;
                    if (s?.width && s?.height) {
                      setAspects(prev => (prev[i] ? prev : { ...prev, [i]: s.width / s.height }));
                    }
                  }}
                />
              ) : it.gradient ? (
                <LinearGradient colors={it.gradient} style={StyleSheet.absoluteFill} />
              ) : null}
              {it.overlay}
            </View>
          );
        })}
      </ScrollView>

      {count > 1 && index > 0 && (
        <View style={[styles.arrowSide, styles.arrowLeft]} pointerEvents="box-none">
          <TouchableOpacity style={styles.arrowBtn} onPress={() => go(index - 1)} activeOpacity={0.85} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
        </View>
      )}
      {count > 1 && index < count - 1 && (
        <View style={[styles.arrowSide, styles.arrowRight]} pointerEvents="box-none">
          <TouchableOpacity style={styles.arrowBtn} onPress={() => go(index + 1)} activeOpacity={0.85} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {count > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'relative', overflow: 'hidden' },
  arrowSide: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  arrowBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  arrowText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 24 },
  dotsRow: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { backgroundColor: '#FFFFFF', width: 7, height: 7, borderRadius: 3.5 },
});
