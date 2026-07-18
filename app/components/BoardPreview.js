import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { computeLayout, normalizeNodes } from '../config/boardLayout';

// Renders a setup's actual board — the arranged node layout with each slot's
// gear photo — scaled to whatever width it's given. Shared by the post composer
// preview and the Home feed card so a posted board looks the same in both.
// If `onItemPress` is given, filled slots become tappable and report their item.
export default function BoardPreview({ setup, items, style, onItemPress }) {
  const [w, setW] = useState(0);
  const nodes = normalizeNodes(setup?.boardLayout, setup?.type);
  const placements = setup?.slots || {};
  const filled = {};
  for (const [nodeId, itemId] of Object.entries(placements)) {
    const it = items?.find(i => i.id === itemId);
    if (it) filled[nodeId] = it;
  }
  const layout = computeLayout(nodes, w);

  return (
    <View
      style={[styles.board, { height: layout.height }, style]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && nodes.map(node => {
        const r = layout.rects[node.id];
        if (!r) return null;
        const item = filled[node.id];
        const photo = item?.photoBase64;
        const tappable = item && onItemPress;
        const Wrapper = tappable ? TouchableOpacity : View;
        return (
          <Wrapper
            key={node.id}
            style={[styles.slot, { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }]}
            {...(tappable ? { onPress: () => onItemPress(item), activeOpacity: 0.8 } : {})}
          >
            {photo && (
              <Image
                source={{ uri: `data:image/png;base64,${photo}` }}
                style={styles.slotImage}
                contentFit="contain"
              />
            )}
          </Wrapper>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, position: 'relative' },
  slot: { backgroundColor: '#F4F4F4', borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotImage: { width: '80%', height: '78%' },
});
