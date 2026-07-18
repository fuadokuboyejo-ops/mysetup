import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';

// Light product card for a photo tag: gear thumbnail, name, "View comments".
// Two layouts: floating (anchored beside a tapped dot) or `inline` (a normal
// block, e.g. shown under the board). Shared by the composer and post detail.
export default function DotCard({ item, dot, onClose, onViewComments, inline }) {
  if (!item || (!inline && !dot)) return null;

  // Anchor to whichever side of the dot has more room (floating layout only).
  const toRight = (dot?.x ?? 0) <= 52;
  const below = (dot?.y ?? 0) <= 48;
  const hStyle = toRight
    ? { left: `${Math.min(dot?.x + 5, 40)}%` }
    : { right: `${Math.min(100 - dot?.x + 5, 40)}%` };
  const vStyle = below
    ? { top: `${Math.min(dot?.y + 7, 50)}%` }
    : { bottom: `${Math.min(100 - dot?.y + 7, 50)}%` };
  const posStyle = inline ? styles.cardInline : [styles.card, hStyle, vStyle];

  const p = item.product || {};
  const title = p.product_name || p.category || 'Item';

  const viewComments = () => {
    if (onViewComments) onViewComments(item);
    else Alert.alert('Coming soon', 'Comments are on the way.');
  };

  return (
    <View style={posStyle}>
      <View style={[styles.thumb, inline && styles.thumbBig]}>
        {item.photoBase64 ? (
          <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={styles.thumbImg} contentFit="contain" />
        ) : (
          <Text style={styles.thumbLabel} numberOfLines={1}>{(p.category || 'gear').toLowerCase()}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, inline && styles.titleBig]} numberOfLines={2}>{title}</Text>
        <TouchableOpacity style={[styles.viewBtn, inline && styles.viewBtnBig]} onPress={viewComments} activeOpacity={0.8}>
          <Text style={[styles.viewIcon, inline && styles.viewIconBig]}>⌁</Text>
          <Text style={[styles.viewText, inline && styles.viewTextBig]}>View comments</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', width: '52%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#ECECEC',
    flexDirection: 'row', alignItems: 'center', padding: 7, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10,
    elevation: 5,
  },
  // Inline (under-the-board) layout: a normal full-width block, no anchoring.
  // Roomier than the floating variant since it isn't covering the photo.
  cardInline: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 1, borderColor: '#ECECEC',
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14,
  },
  thumbBig: { width: 64, height: 64, borderRadius: 12 },
  titleBig: { fontSize: 15.5, lineHeight: 20 },
  viewBtnBig: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, gap: 7 },
  viewIconBig: { fontSize: 13 },
  viewTextBig: { fontSize: 13 },
  thumb: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#F4F4F4',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  thumbImg: { width: '82%', height: '82%' },
  thumbLabel: { color: '#B4B4B4', fontSize: 9, fontWeight: '600' },
  info: { flex: 1, gap: 1, paddingRight: 10 },
  title: { color: '#161616', fontSize: 12.5, fontWeight: '700' },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 5, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#E2E2E2', borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 9,
  },
  viewIcon: { color: '#161616', fontSize: 10, fontWeight: '700' },
  viewText: { color: '#161616', fontSize: 11, fontWeight: '700' },
  close: {
    position: 'absolute', top: 5, right: 5,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#B4B4B4', fontSize: 11, fontWeight: '600' },
});
