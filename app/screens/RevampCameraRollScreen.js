import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { normalizeNodes, computeLayout, nodeSpan } from '../config/boardLayout';
import { getAllItems, getSetups } from '../config/setup';

export default function RevampCameraRollScreen({ photo, setup, onPhotoChange, onBack, onEditBoard, onArrangeBoard, onContinue }) {
  const [boardWidth, setBoardWidth] = useState(0);
  const [placedItems, setPlacedItems] = useState({});
  const nodes = normalizeNodes(setup?.boardLayout, setup?.type || 'pc');
  const boardLayout = computeLayout(nodes, boardWidth);

  useEffect(() => {
    let active = true;

    const loadBoardItems = async () => {
      if (!setup?.id) {
        if (active) setPlacedItems({});
        return;
      }

      try {
        const [setups, items] = await Promise.all([getSetups(), getAllItems()]);
        const savedSetup = setups.find(candidate => candidate.id === setup.id) || setup;
        const itemsById = Object.fromEntries(items.map(item => [item.id, item]));
        const next = Object.fromEntries(
          Object.entries(savedSetup.slots || {})
            .map(([nodeId, itemId]) => [nodeId, itemsById[itemId]])
            .filter(([, item]) => item),
        );
        if (active) setPlacedItems(next);
      } catch {
        if (active) setPlacedItems({});
      }
    };

    loadBoardItems();
    return () => { active = false; };
  }, [setup?.id]);

  const choosePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to choose a setup photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onPhotoChange({ uri: asset.uri, base64: asset.base64 });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Camera roll</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.eyebrow}>TRY DIFFERENT GEAR</Text>
            <Text style={styles.title}>Add a photo of your setup</Text>
            <Text style={styles.subtitle}>
              Choose a clear photo from your camera roll. A straight-on view with the full desk visible works best.
            </Text>
          </View>

          <View style={styles.photoWrap}>
            <View style={styles.photoShadow} />
            <TouchableOpacity style={styles.photoCard} onPress={choosePhoto} activeOpacity={0.85}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
              ) : (
                <View style={styles.emptyPhoto}>
                  <Image source={require('../assets/cameraroll_pic.png')} style={styles.photoArt} resizeMode="contain" />
                  <Text style={styles.emptyTitle}>Add from camera roll</Text>
                  <Text style={styles.emptyBody}>Tap here to choose a setup photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.boardSection}>
            <View style={styles.boardHeadingRow}>
              <View style={styles.boardHeadingCopy}>
                <Text style={styles.boardTitle}>Your board</Text>
                <Text style={styles.boardSubtitle}>Set up the gear slots you want to change.</Text>
              </View>
              <TouchableOpacity style={styles.editBoardBtn} onPress={onEditBoard} activeOpacity={0.8}>
                <Text style={styles.editBoardText}>Edit board</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.boardWrap}>
              <View style={styles.boardShadow} />
              <View
                style={[styles.board, { height: boardLayout.height }]}
                onLayout={event => setBoardWidth(event.nativeEvent.layout.width)}
              >
                {boardWidth > 0 && nodes.map(node => {
                  const rect = boardLayout.rects[node.id];
                  if (!rect) return null;
                  const span = nodeSpan(node);
                  const vertical = span.rh > span.cw;
                  const item = placedItems[node.id];
                  return (
                    <View
                      key={node.id}
                      style={[
                        styles.boardSlot,
                        item && styles.boardSlotFilled,
                        { left: rect.x, top: rect.y, width: rect.w, height: rect.h },
                      ]}
                    >
                      {item ? (
                        <>
                          <Image
                            source={{ uri: `data:image/png;base64,${item.photoBase64}` }}
                            style={styles.boardItemImage}
                            resizeMode="contain"
                          />
                          <Text style={styles.boardItemName} numberOfLines={1}>
                            {item.product?.product_name || node.label || 'Item'}
                          </Text>
                        </>
                      ) : (
                        <>
                          {!vertical && <Text style={styles.boardPlus}>+</Text>}
                          <Text style={[styles.boardSlotLabel, vertical && styles.boardSlotLabelVertical]} numberOfLines={1}>
                            {node.label || 'slot'}
                          </Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.arrangeWrap}>
              <View style={styles.arrangeShadow} />
              <TouchableOpacity style={styles.arrangeBtn} onPress={onArrangeBoard} activeOpacity={0.85}>
                <Text style={styles.arrangeText}>Arrange board</Text>
                <Text style={styles.arrangeChevron}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>For the best result</Text>
            <Text style={styles.tipText}>• Keep the desk and main gear in frame</Text>
            <Text style={styles.tipText}>• Use a bright, sharp photo</Text>
            <Text style={styles.tipText}>• Avoid people blocking the setup</Text>
          </View>

          <View style={styles.actions}>
            {photo ? (
              <>
                <TouchableOpacity style={styles.secondaryBtn} onPress={choosePhoto} activeOpacity={0.8}>
                  <Text style={styles.secondaryText}>Choose another photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => onContinue(photo)} activeOpacity={0.85}>
                  <Text style={styles.primaryText}>Use this photo</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={choosePhoto} activeOpacity={0.85}>
                <Text style={styles.primaryText}>Choose from camera roll</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#F3E9E7',
  card: '#FFFFFF',
  text: '#161616',
  sub: '#766F7D',
  purple: '#6D5EF0',
  shadow: '#615A78',
  border: '#161616',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 30, fontWeight: '300' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, gap: 20 },
  eyebrow: { color: C.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subtitle: { color: C.sub, fontSize: 14, lineHeight: 21, marginTop: 10 },
  photoWrap: { position: 'relative' },
  photoShadow: {
    position: 'absolute', top: 5, left: 5, right: -5, bottom: -5,
    backgroundColor: C.shadow, borderRadius: 22,
  },
  photoCard: {
    height: 245, backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border, overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  emptyPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  photoArt: { width: 120, height: 98 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 8 },
  emptyBody: { color: C.sub, fontSize: 13, marginTop: 5 },
  boardSection: { gap: 12 },
  boardHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boardHeadingCopy: { flex: 1 },
  boardTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  boardSubtitle: { color: C.sub, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  editBoardBtn: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10,
  },
  editBoardText: { color: C.text, fontSize: 12.5, fontWeight: '800' },
  boardWrap: { position: 'relative' },
  boardShadow: {
    position: 'absolute', top: 4, left: 4, right: -4, bottom: -4,
    backgroundColor: C.shadow, borderRadius: 19,
  },
  board: {
    position: 'relative', backgroundColor: '#F6F3EF', borderRadius: 17,
    borderWidth: 1.5, borderColor: C.border, overflow: 'hidden',
  },
  boardSlot: {
    position: 'absolute', backgroundColor: C.card, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#9E98A5', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  boardSlotFilled: { borderStyle: 'solid', borderColor: C.border, backgroundColor: '#FFFFFF' },
  boardItemImage: { width: '82%', height: '68%' },
  boardItemName: { color: C.text, fontSize: 9.5, fontWeight: '700', maxWidth: '88%', marginTop: 2 },
  boardPlus: { color: C.sub, fontSize: 17, fontWeight: '400', lineHeight: 18 },
  boardSlotLabel: { color: C.sub, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  boardSlotLabelVertical: { transform: [{ rotate: '-90deg' }], width: 90, textAlign: 'center' },
  arrangeWrap: { position: 'relative', marginTop: 2 },
  arrangeShadow: {
    position: 'absolute', top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: C.shadow, borderRadius: 15,
  },
  arrangeBtn: {
    minHeight: 54, backgroundColor: C.card, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  arrangeText: { color: C.text, fontSize: 15, fontWeight: '800' },
  arrangeChevron: { color: C.text, fontSize: 24, fontWeight: '300' },
  tipCard: {
    backgroundColor: 'rgba(255,255,255,0.58)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, gap: 5,
  },
  tipTitle: { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  tipText: { color: C.sub, fontSize: 12.5, lineHeight: 18 },
  actions: { gap: 10 },
  primaryBtn: { backgroundColor: C.text, borderRadius: 15, paddingVertical: 17, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: C.card, borderRadius: 15, borderWidth: 1.5,
    borderColor: C.border, paddingVertical: 15, alignItems: 'center',
  },
  secondaryText: { color: C.text, fontSize: 14, fontWeight: '700' },
});
