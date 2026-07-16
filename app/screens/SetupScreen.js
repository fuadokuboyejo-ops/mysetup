import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, PanResponder, Modal, SafeAreaView, StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSetupItems, removeSetupItem, updateSetupPhoto, updateSetupDots, updateSetupSlots, getSetups, deleteSetup } from '../config/setup';
import {
  computeLayout, normalizeNodes, nodeSpan, getVisualScale,
} from '../config/boardLayout';
import PostComposerScreen from './PostComposerScreen';

const SLOT_DEFS = [
  { key: 'monitor',    label: 'monitor',    categories: ['monitor', 'display', 'screen', 'tv'] },
  { key: 'keyboard',   label: 'kbd',        categories: ['keyboard'] },
  { key: 'mouse',      label: 'mouse',      categories: ['mouse', 'trackpad', 'trackball'] },
  { key: 'pc_tower',   label: 'PC tower',   categories: ['pc tower', 'tower', 'desktop pc', 'computer case', 'pc case', 'gaming pc', 'mini itx', 'atx'] },
  { key: 'deskmat',    label: 'deskmat',    categories: ['deskmat', 'mat', 'mousepad', 'desk mat', 'mouse mat'] },
  { key: 'headphones', label: 'headphones', categories: ['headphones', 'audio', 'headset', 'speakers', 'earbuds'] },
];

function autoMatchSlots(items) {
  const slots = {};
  const used = new Set();
  for (const s of SLOT_DEFS) slots[s.key] = null;
  for (const item of items) {
    const cat = (item.product?.category || '').toLowerCase();
    const name = (item.product?.product_name || '').toLowerCase();
    for (const s of SLOT_DEFS) {
      if (!slots[s.key] && s.categories.some(c => cat.includes(c) || name.includes(c))) {
        slots[s.key] = item; used.add(item.id); break;
      }
    }
  }
  return slots;
}

// ─── DropSlot — defined OUTSIDE ArrangeBoardModal so React never remounts it ──
function DropSlot({ slotKey, label, wide, medium, tower, item, hovered, slotRefs, onMeasure }) {
  return (
    <View
      ref={r => { slotRefs.current[slotKey] = r; }}
      onLayout={() => onMeasure(slotKey)}
      style={[
        A.dropSlot,
        wide && A.dropSlotWide,
        medium && A.dropSlotMedium,
        tower && A.dropSlotTower,
        !wide && !medium && !tower && A.dropSlotSmall,
        item && A.dropSlotFilled,
        hovered && A.dropSlotHovered,
      ]}
    >
      {item ? (
        <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={A.dropSlotImg} resizeMode="contain" />
      ) : (
        <Text style={[A.dropSlotLabel, hovered && A.dropSlotLabelHovered]}>
          {hovered ? 'drop here' : label}
        </Text>
      )}
    </View>
  );
}

// ─── Arrange Board Modal ─────────────────────────────────────────────────────
function ArrangeBoardModal({ visible, items, initialSlots, onSave, onClose }) {
  const [slots, setSlots] = useState({});
  const [dragItem, setDragItem] = useState(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const slotRefs = useRef({});
  const slotLayouts = useRef({});
  const dragItemRef = useRef(null);
  const panResponders = useRef({});

  useEffect(() => {
    if (visible) {
      setSlots({ ...initialSlots });
      panResponders.current = {};
    }
  }, [visible]);

  // useCallback keeps measureSlot stable so DropSlot doesn't re-render unnecessarily
  const measureSlot = useCallback((key) => {
    slotRefs.current[key]?.measure((_, __, w, h, px, py) => {
      slotLayouts.current[key] = { x: px, y: py, w, h };
    });
  }, []);

  const measureAll = useCallback(() => {
    Object.keys(slotRefs.current).forEach(k => measureSlot(k));
  }, [measureSlot]);

  const getSlotAt = (px, py) => {
    for (const [key, l] of Object.entries(slotLayouts.current)) {
      if (l && px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h) return key;
    }
    return null;
  };

  const makePR = (item) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      measureAll(); // re-measure right before drag to get accurate positions
      dragItemRef.current = item;
      setDragItem(item);
      setGhostPos({ x: e.nativeEvent.pageX - 38, y: e.nativeEvent.pageY - 38 });
      setIsDragging(true);
    },
    onPanResponderMove: (e) => {
      setGhostPos({ x: e.nativeEvent.pageX - 38, y: e.nativeEvent.pageY - 38 });
      setHoveredSlot(getSlotAt(e.nativeEvent.pageX, e.nativeEvent.pageY));
    },
    onPanResponderRelease: (e) => {
      const slot = getSlotAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
      if (slot && dragItemRef.current) setSlots(prev => ({ ...prev, [slot]: dragItemRef.current }));
      dragItemRef.current = null;
      setDragItem(null); setHoveredSlot(null); setIsDragging(false);
    },
    onPanResponderTerminate: () => {
      dragItemRef.current = null;
      setDragItem(null); setHoveredSlot(null); setIsDragging(false);
    },
  });

  const getPR = (item) => {
    if (!panResponders.current[item.id]) panResponders.current[item.id] = makePR(item);
    return panResponders.current[item.id];
  };

  const shortName = (item) => (item.product?.product_name || 'item').split(' ').slice(0, 2).join(' ').toLowerCase();

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={A.container}>
        {/* Header */}
        <View style={A.header}>
          <TouchableOpacity onPress={onClose} style={A.headerBack}>
            <Text style={A.headerBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={A.headerTitle}>Arrange board</Text>
          <TouchableOpacity style={A.saveBtn} onPress={() => onSave(slots)}>
            <Text style={A.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Board */}
        <View style={A.board}>
          <View style={A.boardMonitorRow}>
            <DropSlot slotKey="monitor" label="monitor" wide item={slots.monitor} hovered={hoveredSlot === 'monitor'} slotRefs={slotRefs} onMeasure={measureSlot} />
          </View>
          <View style={A.boardMiddleRow}>
            <View style={A.boardLeftCol}>
              <View style={A.boardSmallRow}>
                <DropSlot slotKey="keyboard" label="kbd" item={slots.keyboard} hovered={hoveredSlot === 'keyboard'} slotRefs={slotRefs} onMeasure={measureSlot} />
                <DropSlot slotKey="mouse" label="mouse" item={slots.mouse} hovered={hoveredSlot === 'mouse'} slotRefs={slotRefs} onMeasure={measureSlot} />
              </View>
              <DropSlot slotKey="headphones" label="headphones" medium item={slots.headphones} hovered={hoveredSlot === 'headphones'} slotRefs={slotRefs} onMeasure={measureSlot} />
              <DropSlot slotKey="deskmat" label="deskmat" medium item={slots.deskmat} hovered={hoveredSlot === 'deskmat'} slotRefs={slotRefs} onMeasure={measureSlot} />
            </View>
            <DropSlot slotKey="pc_tower" label="PC tower" tower item={slots.pc_tower} hovered={hoveredSlot === 'pc_tower'} slotRefs={slotRefs} onMeasure={measureSlot} />
          </View>
        </View>

        {/* Items library */}
        <Text style={A.libraryLabel}>your stored photos · drag onto the board</Text>
        <ScrollView contentContainerStyle={A.grid} showsVerticalScrollIndicator={false} scrollEnabled={!isDragging}>
          {items.map(item => {
            const pr = getPR(item);
            return (
              <View key={item.id} style={A.gridItem} {...pr.panHandlers}>
                {item.photoBase64 ? (
                  <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={A.gridPhoto} resizeMode="contain" />
                ) : (
                  <View style={A.gridPhoto} />
                )}
                <Text style={A.gridLabel} numberOfLines={1}>{shortName(item)}</Text>
              </View>
            );
          })}
          <TouchableOpacity style={[A.gridItem, A.gridItemAdd]}>
            <Text style={A.gridAddPlus}>+</Text>
          </TouchableOpacity>
        </ScrollView>
        <Text style={A.libraryFooter}>library of everything you've captured</Text>

        {/* Ghost image follows finger */}
        {isDragging && dragItem && (
          <View style={[A.ghost, { left: ghostPos.x, top: ghostPos.y }]} pointerEvents="none">
            <Image source={{ uri: `data:image/png;base64,${dragItem.photoBase64}` }} style={A.ghostImg} resizeMode="contain" />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Photo Tab: Dot ──────────────────────────────────────────────────────────
function PhotoDot({ dot, selected, editing, onPress, onRemove }) {
  return (
    <TouchableOpacity
      style={[P.dot, { left: `${dot.x}%`, top: `${dot.y}%` }]}
      onPress={() => onPress(dot)}
      activeOpacity={0.8}
    >
      <View style={[P.dotGlow, selected && P.dotGlowSelected]}>
        <View style={[P.dotInner, selected && P.dotInnerSelected]} />
      </View>
      {editing && (
        <TouchableOpacity
          style={P.dotRemove}
          onPress={() => onRemove(dot.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={P.dotRemoveText}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Photo Tab: Draggable existing dot — lets user reposition placed tags ─────
function DraggableDot({ dot, photoLayoutRef, moveDotRef, onRemove }) {
  const [dragging, setDragging] = useState(false);

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Only claim gesture after a small move so the X button still works on tap
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
    onPanResponderGrant: () => setDragging(true),
    onPanResponderMove: (e) => {
      const pl = photoLayoutRef.current;
      if (!pl) return;
      const x = Math.round(Math.max(2, Math.min(98, (e.nativeEvent.pageX - pl.x) / pl.w * 100)));
      const y = Math.round(Math.max(2, Math.min(98, (e.nativeEvent.pageY - pl.y) / pl.h * 100)));
      moveDotRef.current?.(dot.id, x, y, false);
    },
    onPanResponderRelease: (e) => {
      const pl = photoLayoutRef.current;
      if (pl) {
        const x = Math.round(Math.max(2, Math.min(98, (e.nativeEvent.pageX - pl.x) / pl.w * 100)));
        const y = Math.round(Math.max(2, Math.min(98, (e.nativeEvent.pageY - pl.y) / pl.h * 100)));
        moveDotRef.current?.(dot.id, x, y, true);
      }
      setDragging(false);
    },
    onPanResponderTerminate: () => setDragging(false),
  })).current;

  return (
    <View
      style={[P.dot, { left: `${dot.x}%`, top: `${dot.y}%` }]}
      {...pr.panHandlers}
    >
      <View style={[P.dotGlow, dragging && P.dotGlowSelected]}>
        <View style={[P.dotInner, dragging && P.dotInnerSelected]} />
      </View>
      <TouchableOpacity
        style={P.dotRemove}
        onPress={() => onRemove(dot.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={P.dotRemoveText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Photo Tab: Draggable item card for tag placement ────────────────────────
function DraggableCard({ item, tagged, panHandlers }) {
  return (
    <View style={[T.draggableCard, tagged && T.draggableCardTagged]} {...panHandlers}>
      {tagged && <View style={T.draggableTaggedDot} />}
      <View style={T.draggableThumb}>
        <Image
          source={{ uri: `data:image/png;base64,${item.photoBase64}` }}
          style={T.draggableThumbImg}
          resizeMode="contain"
        />
      </View>
      <Text style={T.draggableName} numberOfLines={2}>
        {(item.product?.product_name || 'Item').split(' ').slice(0, 3).join(' ')}
      </Text>
    </View>
  );
}

// ─── Photo Tab: Row shown below the photo for each tagged item ───────────────
function PhotoItemRow({ item }) {
  return (
    <TouchableOpacity
      style={T.itemRow}
      onPress={() => Alert.alert('Coming soon', 'Product detail pages are in progress.')}
      activeOpacity={0.8}
    >
      <View style={T.itemRowThumb}>
        <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={T.itemRowImg} resizeMode="contain" />
      </View>
      <View style={T.itemRowInfo}>
        {!!item.product?.brand && item.product.brand !== 'Unknown' && (
          <Text style={T.itemRowBrand}>{item.product.brand.toUpperCase()}</Text>
        )}
        <Text style={T.itemRowName} numberOfLines={1}>{item.product?.product_name}</Text>
        <Text style={T.itemRowCat}>{item.product?.category}</Text>
      </View>
      <Text style={T.itemRowChev}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Photo Tab: Item Card — positioned next to the tapped dot ────────────────
function DotItemCard({ item, dot, onClose }) {
  if (!item || !dot) return null;

  // Anchor the card to whichever side of the dot has more room
  const toRight = dot.x <= 52;
  const below   = dot.y <= 48;
  const hStyle  = toRight
    ? { left:  `${Math.min(dot.x + 5, 40)}%` }
    : { right: `${Math.min(100 - dot.x + 5, 40)}%` };
  const vStyle  = below
    ? { top:    `${Math.min(dot.y + 7, 50)}%` }
    : { bottom: `${Math.min(100 - dot.y + 7, 50)}%` };

  return (
    <View style={[P.card, hStyle, vStyle]}>
      <View style={P.cardThumb}>
        <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={P.cardThumbImg} resizeMode="contain" />
      </View>
      <View style={P.cardInfo}>
        {!!item.product?.brand && item.product.brand !== 'Unknown' && (
          <Text style={P.cardBrand}>{item.product.brand.toUpperCase()}</Text>
        )}
        <Text style={P.cardName} numberOfLines={2}>{item.product?.product_name}</Text>
        <Text style={P.cardCategory}>{item.product?.category}</Text>
      </View>
      <TouchableOpacity style={P.cardClose} onPress={onClose}>
        <Text style={P.cardCloseText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main SetupScreen ─────────────────────────────────────────────────────────
export default function SetupScreen({ setup, initialView = 'board', autoArrange = false, onBack, onScanMore, onDelete, onEditBoard }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(initialView);
  // Per-setup board placements — { [nodeId]: itemId } into the shared item library.
  const [boardSlots, setBoardSlots] = useState(setup?.slots || {});
  const [pickerNode, setPickerNode] = useState(null); // slot awaiting an item choice
  const [tagsOn, setTagsOn] = useState(false);
  const [selectedDot, setSelectedDot] = useState(null);
  const [dots, setDots] = useState([]);
  const [setupPhoto, setSetupPhoto] = useState(setup?.photo || null);
  const [boardLayout, setBoardLayout] = useState(setup?.boardLayout || null);
  const [boardW, setBoardW] = useState(0);

  // Tag drag state
  const [dragCard, setDragCard] = useState(null);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  // Full-screen arrange page (drag items onto/between slots) — opens
  // immediately when arriving via a deep link (e.g. Revamp's "Arrange board").
  const [arranging, setArranging] = useState(autoArrange);
  const [postComposerOpen, setPostComposerOpen] = useState(false);

  // Board item drag — place from the tray onto a slot, or move between slots.
  const [boardDrag, setBoardDrag] = useState(null);       // { item, fromNode }
  const [boardGhost, setBoardGhost] = useState({ x: 0, y: 0 });
  const [hoverNode, setHoverNode] = useState(null);
  const boardDragRef = useRef(null);
  const slotRectsRef = useRef({});
  const boardPRCache = useRef({});

  // Refs for drag-to-tag
  const dragCardRef = useRef(null);
  const photoRef = useRef(null);
  const photoLayout = useRef(null);
  const photoOuterRef = useRef(null);
  const photoOuterPos = useRef({ x: 0, y: 0 });
  const dotsRef = useRef([]);
  const setupIdRef = useRef(setup?.id || 'default');
  const cardPRCache = useRef({});

  // moveDotRef — always holds the latest move handler, read by DraggableDot PanResponder
  const moveDotRef = useRef(null);
  moveDotRef.current = (dotId, xPct, yPct, save = false) => {
    const newDots = dotsRef.current.map(d => d.id === dotId ? { ...d, x: xPct, y: yPct } : d);
    dotsRef.current = newDots;
    setDots(newDots);
    if (save) updateSetupDots(setupIdRef.current, newDots);
  };

  useEffect(() => { dotsRef.current = dots; }, [dots]);
  useEffect(() => { setupIdRef.current = setup?.id || 'default'; }, [setup?.id]);

  const load = useCallback(async () => {
    const setupId = setup?.id || 'default';
    const data = await getSetupItems(setupId);
    setItems(data);
    const allSetups = await getSetups();
    const current = allSetups.find(s => s.id === setupId);
    if (current?.photo) setSetupPhoto(current.photo);
    if (current?.dots) setDots(current.dots);
    setBoardSlots(current?.slots || {});
    if (current?.boardLayout?.length) setBoardLayout(current.boardLayout);
    else setBoardLayout(null);
    setLoading(false);
  }, [setup?.id]);

  // ── Board placement (per-setup) ──────────────────────────────────────────────
  const persistSlots = (next) => {
    setBoardSlots(next);
    updateSetupSlots(setup?.id || 'default', next);
  };
  const assignSlot = (nodeId, itemId) => {
    persistSlots({ ...boardSlots, [nodeId]: itemId });
    setPickerNode(null);
  };
  const clearSlot = (nodeId) => {
    const next = { ...boardSlots };
    delete next[nodeId];
    persistSlots(next);
  };

  const pickPhoto = () => {
    Alert.alert('Setup photo', null, [
      {
        text: 'Take photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow camera access to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            const b64 = result.assets[0].base64;
            setSetupPhoto(b64);
            await updateSetupPhoto(setup?.id || 'default', b64);
          }
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow photo library access to add a setup photo.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true,
          });
          if (!result.canceled && result.assets?.[0]?.base64) {
            const b64 = result.assets[0].base64;
            setSetupPhoto(b64);
            await updateSetupPhoto(setup?.id || 'default', b64);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  useEffect(() => { load(); }, [load]);

  // ── Tag placement helpers ────────────────────────────────────────────────────
  const removeDot = (dotId) => {
    const newDots = dotsRef.current.filter(d => d.id !== dotId);
    setDots(newDots);
    updateSetupDots(setupIdRef.current, newDots);
  };

  const makeCardPR = useCallback((item) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      // Measure fresh positions right before drag starts
      photoRef.current?.measure((_, __, w, h, px, py) => {
        photoLayout.current = { x: px, y: py, w, h };
      });
      photoOuterRef.current?.measure((_, __, w, h, px, py) => {
        photoOuterPos.current = { x: px, y: py };
      });
      dragCardRef.current = item;
      setDragCard(item);
      setGhostPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
      setIsDraggingCard(true);
    },
    onPanResponderMove: (e) => {
      setGhostPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
    },
    onPanResponderRelease: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      const pl = photoLayout.current;
      const cur = dragCardRef.current;
      if (pl && cur && pageX >= pl.x && pageX <= pl.x + pl.w && pageY >= pl.y && pageY <= pl.y + pl.h) {
        const xPct = Math.round((pageX - pl.x) / pl.w * 100);
        const yPct = Math.round((pageY - pl.y) / pl.h * 100);
        const newDot = { id: Date.now().toString(), x: xPct, y: yPct, libraryItemId: cur.id };
        // Replace any existing dot for this item
        const newDots = [...dotsRef.current.filter(d => d.libraryItemId !== cur.id), newDot];
        setDots(newDots);
        updateSetupDots(setupIdRef.current, newDots);
      }
      dragCardRef.current = null;
      setDragCard(null);
      setIsDraggingCard(false);
    },
    onPanResponderTerminate: () => {
      dragCardRef.current = null;
      setDragCard(null);
      setIsDraggingCard(false);
    },
  }), []);

  const getCardPR = useCallback((item) => {
    if (!cardPRCache.current[item.id]) cardPRCache.current[item.id] = makeCardPR(item);
    return cardPRCache.current[item.id];
  }, [makeCardPR]);

  // Reset PR cache when items list changes (new scans)
  useEffect(() => { cardPRCache.current = {}; }, [items]);
  // Board-drag handlers close over boardSlots — rebuild them when placements change.
  useEffect(() => { boardPRCache.current = {}; }, [items, boardSlots]);

  const handleRemove = (id, name) => {
    Alert.alert('Remove Item', `Remove ${name} from your setup?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await removeSetupItem(setup?.id || 'default', id);
          if (selected?.id === id) setSelected(null);
          // Drop it from this board's placements too.
          const next = { ...boardSlots };
          let changed = false;
          for (const k of Object.keys(next)) if (next[k] === id) { delete next[k]; changed = true; }
          if (changed) persistSlots(next);
          load();
        },
      },
    ]);
  };

  // Always resolve to a board: the saved layout, or this setup type's starter board.
  const layoutNodes = normalizeNodes(boardLayout, setup?.type);
  // Resolve this board's saved placements (nodeId → itemId) against the shared
  // item library. Missing items (deleted from the library) simply show empty.
  const slots = {};
  for (const [nodeId, itemId] of Object.entries(boardSlots)) {
    const it = items.find(i => i.id === itemId);
    if (it) slots[nodeId] = it;
  }
  const gridLayout = layoutNodes ? computeLayout(layoutNodes, boardW) : null;
  // Only true cut-outs (isCutout !== false) can be placed on the board — items
  // still in your library are unaffected, this just gates the tray/picker.
  const boardEligibleItems = items.filter(it => it.isCutout !== false);
  const slotRefs = useRef({});

  // ── Board item drag-and-drop ────────────────────────────────────────────────
  // Capture each slot's on-screen rect so we can hit-test the drop under a finger.
  const measureSlots = () => {
    Object.entries(slotRefs.current).forEach(([id, ref]) => {
      ref?.measure?.((x, y, w, h, px, py) => { slotRectsRef.current[id] = { x: px, y: py, w, h }; });
    });
  };
  const nodeAt = (px, py) => {
    for (const [id, r] of Object.entries(slotRectsRef.current)) {
      if (r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return id;
    }
    return null;
  };
  // Move an item onto a node. From the tray: displace any current occupant and
  // pull the item out of any other slot. Between slots: swap.
  const placeItemOnNode = (itemId, fromNode, toNode) => {
    if (!toNode || fromNode === toNode) return;
    const next = { ...boardSlots };
    if (fromNode) {
      const occupant = next[toNode];
      if (occupant) next[fromNode] = occupant; else delete next[fromNode];
      next[toNode] = itemId;
    } else {
      for (const k of Object.keys(next)) if (next[k] === itemId) delete next[k];
      next[toNode] = itemId;
    }
    persistSlots(next);
  };

  const makeBoardPR = (item, fromNode) => PanResponder.create({
    // Tray cards claim on touch; placed slots wait for movement so taps still select.
    onStartShouldSetPanResponder: () => fromNode == null,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,
    onMoveShouldSetPanResponderCapture: (_, gs) => Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,
    onPanResponderGrant: (e) => {
      measureSlots();
      boardDragRef.current = { item, fromNode };
      setBoardDrag({ item, fromNode });
      setBoardGhost({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
    },
    onPanResponderMove: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      setBoardGhost({ x: pageX, y: pageY });
      setHoverNode(nodeAt(pageX, pageY));
    },
    onPanResponderRelease: (e) => {
      const target = nodeAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
      const drag = boardDragRef.current;
      if (drag && target) placeItemOnNode(drag.item.id, drag.fromNode, target);
      boardDragRef.current = null;
      setBoardDrag(null);
      setHoverNode(null);
    },
    onPanResponderTerminate: () => {
      boardDragRef.current = null;
      setBoardDrag(null);
      setHoverNode(null);
    },
  });
  const getBoardPR = (item, fromNode) => {
    const key = `${item.id}:${fromNode || 'tray'}`;
    if (!boardPRCache.current[key]) boardPRCache.current[key] = makeBoardPR(item, fromNode);
    return boardPRCache.current[key];
  };

  // Shared board grid — display-only on the Board tab, draggable on the Arrange page.
  const renderBoardGrid = (interactive) => (
    <View
      style={[styles.board, styles.boardGrid, { height: gridLayout?.height }]}
      onLayout={e => setBoardW(e.nativeEvent.layout.width)}
    >
      {boardW > 0 && layoutNodes.map(node => {
        const r = gridLayout?.rects[node.id];
        if (!r) return null;
        const item = slots[node.id];
        const isSelected = !!item && !!selected && selected.id === item.id;
        const span = nodeSpan(node);
        const labelVertical = span.rh > span.cw;
        const label = node.label?.trim() || 'slot';
        const isHover = interactive && hoverNode === node.id;
        const dragHandlers = interactive && item ? getBoardPR(item, node.id).panHandlers : {};
        return (
          <View
            key={node.id}
            ref={ref => { slotRefs.current[node.id] = ref; }}
            {...dragHandlers}
            style={[
              styles.slot,
              { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h },
              isSelected && styles.slotSelected,
              !item && styles.slotEmpty,
              isHover && styles.slotHover,
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => item ? setSelected(isSelected ? null : item) : setPickerNode(node.id)}
              activeOpacity={0.75}
            />
            {item ? (
              (() => {
                const vw = getVisualScale(item);
                return (
                  <Image
                    source={{ uri: `data:image/png;base64,${item.photoBase64}` }}
                    style={[styles.slotImage, { width: `${vw.widthPct * 100}%`, height: `${vw.heightPct * 100}%` }]}
                    resizeMode="contain"
                  />
                );
              })()
            ) : (
              <View style={styles.emptySlotContent} pointerEvents="none">
                {!labelVertical && <Text style={styles.emptySlotPlus}>+</Text>}
                <Text style={[styles.slotLabel, labelVertical && { transform: [{ rotate: '90deg' }] }]}>{label}</Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Little edit pill pinned to the board's top-left — Board tab only
          (the Arrange page reuses this grid and shouldn't show it). Opens the
          board builder to edit this setup's layout. */}
      {!interactive && onEditBoard && (
        <TouchableOpacity
          style={styles.boardEditBtn}
          onPress={onEditBoard}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.boardEditText}>✎ Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Draggable item tray (Arrange page).
  const renderTray = () => (
    <View style={styles.trayRow}>
      {boardEligibleItems.map(item => {
        const placed = Object.values(boardSlots).includes(item.id);
        const dragging = boardDrag?.item?.id === item.id && boardDrag?.fromNode == null;
        return (
          <View
            key={item.id}
            {...getBoardPR(item, null).panHandlers}
            style={[styles.trayCard, placed && styles.trayCardPlaced, dragging && styles.trayCardDragging]}
          >
            <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={styles.trayImg} resizeMode="contain" />
            <Text style={styles.trayName} numberOfLines={1}>{item.product?.product_name || 'item'}</Text>
            {placed && <View style={styles.trayDot} />}
          </View>
        );
      })}
      <TouchableOpacity style={styles.addPeripheralBtn} onPress={onScanMore} activeOpacity={0.75}>
        <Text style={styles.addPeripheralPlus}>+</Text>
        <Text style={styles.addPeripheralText}>Add</Text>
      </TouchableOpacity>
    </View>
  );

  const SlotCard = ({ slotKey, label, style: extraStyle, textRotate }) => {
    const item = slots[slotKey];
    const isSelected = !!item && !!selected && selected.id === item.id;
    return (
      <View ref={r => { slotRefs.current[slotKey] = r; }} style={[styles.slot, isSelected && styles.slotSelected, !item && styles.slotEmpty, extraStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => item ? setSelected(isSelected ? null : item) : setPickerNode(slotKey)} activeOpacity={0.75} />
        {item ? (() => {
          const vw = getVisualScale(item);
          return (
            <Image
              source={{ uri: `data:image/png;base64,${item.photoBase64}` }}
              style={[styles.slotImage, { width: `${vw.widthPct * 100}%`, height: `${vw.heightPct * 100}%` }]}
              resizeMode="contain"
            />
          );
        })() : (
          <View style={styles.emptySlotContent} pointerEvents="none">
            <Text style={styles.emptySlotPlus}>+</Text>
            <Text style={[styles.slotLabel, textRotate && { transform: [{ rotate: '90deg' }] }]}>{label}</Text>
          </View>
        )}
      </View>
    );
  };

  const handleDeleteSetup = () => {
    if (!setup?.id) return;
    Alert.alert(
      'Delete Setup',
      `Delete "${setup.name || 'this setup'}"? This removes the board and photo — your items stay in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSetup(setup.id);
            onDelete?.();
          },
        },
      ],
    );
  };

  // ── Arrange page — drag items onto the board, or between slots ──────────────
  // Arriving via a deep link (e.g. Revamp's "Arrange board") returns straight
  // there when done; opened from within the setup screen just closes back to it.
  const exitArrange = () => (autoArrange ? onBack() : setArranging(false));

  if (arranging) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={exitArrange} style={styles.headerBtn}>
            <Text style={styles.chevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.setupName} numberOfLines={1}>Arrange board</Text>
          <TouchableOpacity onPress={exitArrange} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Plain View (not a ScrollView) so the drag gestures aren't swallowed by scroll. */}
        <View style={styles.arrangeBody}>
          {renderBoardGrid(true)}

          <View style={styles.extrasSection}>
            <View style={styles.extrasHeader}>
              <Text style={styles.extrasTitle}>Your items</Text>
              <Text style={styles.extrasSubtitle}> · drag onto the board</Text>
            </View>
            {renderTray()}
            <Text style={styles.arrangeHint}>Drag an item onto a slot, or drag between slots to rearrange.</Text>
          </View>
        </View>

        {/* Ghost that follows the finger while dragging. */}
        {boardDrag && (
          <View style={[styles.boardGhost, { left: boardGhost.x - 44, top: boardGhost.y - 44 }]} pointerEvents="none">
            <Image source={{ uri: `data:image/png;base64,${boardDrag.item.photoBase64}` }} style={styles.boardGhostImg} resizeMode="contain" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.setupName} numberOfLines={1}>{setup?.name || 'My Setup'}</Text>
        <TouchableOpacity
          style={styles.headerDeleteBtn}
          onPress={handleDeleteSetup}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteIcon}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.toggleRow, view === 'photo' && { paddingBottom: 0 }]}>
        <View style={styles.toggle}>
          {[['photo','Photo'],['board','Board'],['items','Items']].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.toggleBtn, view === key && styles.toggleActive]} onPress={() => setView(key)}>
              <Text style={[styles.toggleText, view === key && styles.toggleTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.accent} /></View>
      ) : view === 'photo' ? (

        /* ── Photo tab ─────────────────────────────────────────────── */
        tagsOn ? (
          /* Edit mode: sidebar — full image on left, items panel on right */
          <View
            style={[styles.photoOuter, styles.photoOuterTagMode]}
            ref={photoOuterRef}
            onLayout={() => {
              photoOuterRef.current?.measure((_, __, w, h, px, py) => {
                photoOuterPos.current = { x: px, y: py };
              });
            }}
          >
            <View style={[styles.photoInner, styles.photoInnerRow]}>
              {/* Photo — contain shows the full image, no cropping */}
              <View
                style={[styles.photoArea, styles.photoAreaTagMode]}
                ref={photoRef}
                onLayout={() => {
                  photoRef.current?.measure((_, __, w, h, px, py) => {
                    photoLayout.current = { x: px, y: py, w, h };
                  });
                }}
              >
                {setupPhoto ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${setupPhoto}` }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>No photo yet</Text>
                  </View>
                )}
                {dots.map(dot => (
                  <DraggableDot
                    key={dot.id}
                    dot={dot}
                    photoLayoutRef={photoLayout}
                    moveDotRef={moveDotRef}
                    onRemove={removeDot}
                  />
                ))}
                <TouchableOpacity
                  style={[styles.tagToggle, styles.tagToggleOn]}
                  onPress={() => { setTagsOn(false); setSelectedDot(null); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tagToggleEye, styles.tagToggleEyeOn]}>✓</Text>
                  <Text style={[styles.tagToggleText, styles.tagToggleTextOn]}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Items panel */}
              <ScrollView
                style={T.tagPanel}
                contentContainerStyle={T.tagPanelContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isDraggingCard}
              >
                <Text style={T.tagPanelHint}>drag to tag</Text>
                {items.map(item => {
                  const tagged = dots.some(d => d.libraryItemId === item.id);
                  return (
                    <DraggableCard
                      key={item.id}
                      item={item}
                      tagged={tagged}
                      panHandlers={getCardPR(item).panHandlers}
                    />
                  );
                })}
              </ScrollView>
            </View>

            {isDraggingCard && dragCard && (
              <View
                style={[T.cardGhost, {
                  left: ghostPos.x - photoOuterPos.current.x - 32,
                  top: ghostPos.y - photoOuterPos.current.y - 32,
                }]}
                pointerEvents="none"
              >
                <Image source={{ uri: `data:image/png;base64,${dragCard.photoBase64}` }} style={T.cardGhostImg} resizeMode="contain" />
              </View>
            )}
          </View>
        ) : (
          /* View mode: scrollable — photo + tagged items below */
          <ScrollView style={styles.photoScroll} showsVerticalScrollIndicator={false} bounces>
            {/* Photo */}
            <View style={styles.photoAreaScroll}>
              {setupPhoto ? (
                <Image source={{ uri: `data:image/jpeg;base64,${setupPhoto}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>◻</Text>
                  <Text style={styles.photoPlaceholderText}>No setup photo yet</Text>
                  <Text style={styles.photoPlaceholderHint}>Show off your full desk</Text>
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                    <Text style={styles.addPhotoBtnText}>+ Add photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {setupPhoto && (
                <TouchableOpacity style={styles.changePhotoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                  <Text style={styles.changePhotoBtnText}>Change</Text>
                </TouchableOpacity>
              )}

              {selectedDot && (
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedDot(null)} activeOpacity={1} />
              )}

              {dots.map(dot => (
                <PhotoDot
                  key={dot.id}
                  dot={dot}
                  selected={selectedDot?.id === dot.id}
                  editing={false}
                  onPress={d => setSelectedDot(prev => prev?.id === d.id ? null : d)}
                  onRemove={removeDot}
                />
              ))}

              <TouchableOpacity
                style={styles.tagToggle}
                onPress={() => { setTagsOn(true); setSelectedDot(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.tagToggleEye}>⊕</Text>
                <Text style={styles.tagToggleText}>Edit tags</Text>
              </TouchableOpacity>

              {selectedDot && (
                <DotItemCard
                  item={items.find(i => i.id === selectedDot.libraryItemId)}
                  dot={selectedDot}
                  onClose={() => setSelectedDot(null)}
                />
              )}
            </View>

            {/* Tagged items below the photo */}
            <View style={styles.photoItemsSection}>
              {dots.length === 0 ? (
                <View style={styles.photoEmptyTags}>
                  <Text style={styles.photoEmptyTagsTitle}>No items tagged yet</Text>
                  <Text style={styles.photoEmptyTagsHint}>Tap "Edit tags" to drag your items onto the photo</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.photoTagsLabel}>In this photo</Text>
                  {dots.map(dot => {
                    const item = items.find(i => i.id === dot.libraryItemId);
                    return item ? <PhotoItemRow key={dot.id} item={item} /> : null;
                  })}
                </>
              )}
            </View>
          </ScrollView>
        )

      ) : items.length === 0 && !(view === 'board' && layoutNodes) ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Your setup is empty</Text>
          <Text style={styles.emptyHint}>Scan a product and tap "Add to My Setup"</Text>
        </View>
      ) : view === 'board' ? (

        /* ── Board tab ─────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.boardScroll} showsVerticalScrollIndicator={false}>
          {layoutNodes ? renderBoardGrid(false) : (
          <View style={styles.board}>
            <View style={styles.monitorRow}>
              <SlotCard slotKey="monitor" label="monitor" style={styles.monitorSlot} />
            </View>
            <View style={styles.middleRow}>
              <View style={styles.leftCol}>
                <View style={styles.smallRow}>
                  <SlotCard slotKey="keyboard" label="kbd" style={styles.smallSlot} />
                  <SlotCard slotKey="mouse" label="mouse" style={styles.smallSlot} />
                </View>
                <SlotCard slotKey="headphones" label="headphones" style={styles.deskmatSlot} />
                <SlotCard slotKey="deskmat" label="deskmat" style={styles.deskmatSlot} />
              </View>
              <SlotCard slotKey="pc_tower" label="PC tower" style={styles.towerSlot} textRotate />
            </View>
          </View>
          )}

          {selected && (
            <View style={styles.detailPanel}>
              <Text style={styles.detailPanelLabel}>{selected.product.category}</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailPhotoBox}>
                  <Image source={{ uri: `data:image/png;base64,${selected.photoBase64}` }} style={styles.detailPhoto} resizeMode="contain" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailCategory}>{selected.product.category}</Text>
                  <Text style={styles.detailName}>{selected.product.product_name}</Text>
                  {!!selected.product.brand && selected.product.brand !== 'Unknown' && (
                    <Text style={styles.detailBrand}>{selected.product.brand}</Text>
                  )}
                  <TouchableOpacity style={styles.viewBtn} onPress={() => Alert.alert('Coming soon', 'Product detail pages are in progress.')}>
                    <Text style={styles.viewBtnText}>View details</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {(() => {
                const selNode = Object.keys(boardSlots).find(nid => boardSlots[nid] === selected.id);
                return selNode ? (
                  <TouchableOpacity style={styles.removeRow} onPress={() => { clearSlot(selNode); setSelected(null); }}>
                    <Text style={styles.removeRowText}>Remove from board</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.removeRow} onPress={() => handleRemove(selected.id, selected.product.product_name)}>
                    <Text style={styles.removeRowText}>Delete from library</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

          <View style={styles.extrasSection}>
            <View style={styles.extrasHeader}>
              <Text style={styles.extrasTitle}>Extras</Text>
              <Text style={styles.extrasSubtitle}> · peripherals & accessories</Text>
            </View>
            <View style={styles.extrasCards}>
              <TouchableOpacity style={styles.addPeripheralBtnRow} onPress={onScanMore} activeOpacity={0.75}>
                <Text style={styles.addPeripheralPlusRow}>+</Text>
                <Text style={styles.addPeripheralTextRow}>Add a peripheral</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.arrangeHint}>Tap an empty slot on the board to place an item from your library.</Text>

            <View style={styles.boardActionsRow}>
              <TouchableOpacity style={styles.arrangeBoardBtn} onPress={() => setArranging(true)} activeOpacity={0.85}>
                <Text style={styles.arrangeBoardText}>⤢  Arrange board</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.postBtn}
                onPress={() => setPostComposerOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.postBtnText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

      ) : (

        /* ── Items tab ─────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.listCards}>
            {items.map(item => {
              return (
                <View key={item.id} style={[styles.listCard, styles.listCardBorder]}>
                  <View style={styles.listPhotoBox}>
                    <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={styles.listPhoto} resizeMode="contain" />
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>{item.product.product_name}</Text>
                    <Text style={styles.listCategory} numberOfLines={1}>{item.product.category}</Text>
                  </View>
                  <TouchableOpacity style={styles.listRemoveBtn} onPress={() => handleRemove(item.id, item.product.product_name)}>
                    <Text style={styles.listRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

      )}

      {/* Slot picker — choose which library item goes in the tapped board slot. */}
      <Modal visible={!!pickerNode} transparent animationType="slide" onRequestClose={() => setPickerNode(null)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerNode(null)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Place an item</Text>
            {items.length === 0 ? (
              <Text style={styles.pickerEmpty}>No items yet — scan a product to build your library.</Text>
            ) : boardEligibleItems.length === 0 ? (
              <Text style={styles.pickerEmpty}>Your items still need their background cut out before they can go on the board.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.pickerGrid} showsVerticalScrollIndicator={false}>
                {boardEligibleItems.map(it => (
                  <TouchableOpacity
                    key={it.id}
                    style={styles.pickerItem}
                    onPress={() => assignSlot(pickerNode, it.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.pickerThumb}>
                      <Image source={{ uri: `data:image/png;base64,${it.photoBase64}` }} style={styles.pickerThumbImg} resizeMode="contain" />
                    </View>
                    <Text style={styles.pickerItemName} numberOfLines={1}>{it.product?.product_name || 'Item'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Post composer — Modal renders in its own native view hierarchy,
          outside the root SafeAreaProvider's reach, so it needs its own. */}
      <Modal visible={postComposerOpen} animationType="slide" onRequestClose={() => setPostComposerOpen(false)}>
        <SafeAreaProvider>
          <PostComposerScreen
            setup={setup}
            items={items}
            onClose={() => setPostComposerOpen(false)}
            onSubmit={(data) => {
              setPostComposerOpen(false);
              Alert.alert('Posted', `"${data.title}" is now live on your feed.`);
            }}
          />
        </SafeAreaProvider>
      </Modal>

    </View>
  );
}

const C = {
  bg: '#FAFAF8', panel: '#F4F4F4', card: '#FAFAFA', nested: '#EDEDED',
  border: '#E0E0E0', borderSubtle: 'rgba(0,0,0,0.06)', text: '#161616', sub: '#6E6E73',
  accent: '#6D5EF0', selected: '#EEEAFE', selBorder: '#6D5EF0',
  hovered: '#E9F7EE', hovBorder: '#3FA35C',
};

// Arrange modal styles
const A = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerBack: { width: 44, height: 44, justifyContent: 'center' },
  headerBackText: { color: C.text, fontSize: 26, fontWeight: '300' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  saveBtn: { backgroundColor: '#8fb8f018', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#8fb8f035' },
  saveBtnText: { color: C.accent, fontSize: 15, fontWeight: '600' },

  board: { margin: 14, backgroundColor: C.panel, borderRadius: 22, borderWidth: 1, borderColor: C.borderSubtle, padding: 14, gap: 10 },
  boardMonitorRow: { alignItems: 'center' },
  boardMiddleRow: { flexDirection: 'row', gap: 8 },
  boardLeftCol: { flex: 1, gap: 8 },
  boardSmallRow: { flexDirection: 'row', gap: 8 },

  dropSlot: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  dropSlotWide:   { width: '68%', height: 100 },
  dropSlotSmall:  { flex: 1, height: 90 },
  dropSlotMedium: { height: 68 },
  dropSlotTower:  { width: 64, alignSelf: 'stretch' },
  dropSlotFilled: { borderStyle: 'solid', borderColor: C.border },
  dropSlotHovered: { borderColor: C.accent, backgroundColor: C.hovered, borderStyle: 'solid', borderWidth: 2 },
  dropSlotImg: { width: '85%', height: '80%' },
  dropSlotLabel: { color: C.sub, fontSize: 12 },
  dropSlotLabelHovered: { color: C.accent },

  libraryLabel: { color: C.sub, fontSize: 12, textAlign: 'center', paddingVertical: 10 },
  libraryFooter: { color: C.sub, fontSize: 11, textAlign: 'center', paddingBottom: 16, paddingTop: 4 },

  grid: { paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '22%', alignItems: 'center', gap: 5 },
  gridPhoto: { width: 70, height: 70, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  gridLabel: { color: C.sub, fontSize: 11, textAlign: 'center' },
  gridItemAdd: { justifyContent: 'center' },
  gridAddPlus: { color: C.sub, fontSize: 28, fontWeight: '200', width: 70, height: 70, textAlign: 'center', lineHeight: 70, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', overflow: 'hidden' },

  ghost: { position: 'absolute', width: 76, height: 76, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
  ghostImg: { width: 64, height: 64 },
});

// Main screen styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerDeleteBtn: { minWidth: 56, height: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  chevron: { color: C.text, fontSize: 28, fontWeight: '300' },
  deleteIcon: { color: '#ff453a', fontSize: 13, fontWeight: '600' },
  setupName: { flex: 1, color: C.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginHorizontal: 4 },

  toggleRow: { alignItems: 'center', paddingBottom: 14 },
  toggle: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 20, padding: 3, borderWidth: 1, borderColor: C.border },
  toggleBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  toggleActive: { backgroundColor: C.card },
  toggleText: { color: C.sub, fontSize: 13, fontWeight: '500' },
  toggleTextActive: { color: C.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: C.text, fontSize: 17, fontWeight: '600' },
  emptyHint: { color: C.sub, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  boardScroll: { paddingHorizontal: 14, paddingBottom: 40 },
  arrangeBody: { flex: 1, paddingHorizontal: 14, paddingTop: 4 },
  board: { backgroundColor: C.panel, borderRadius: 22, borderWidth: 1, borderColor: C.borderSubtle, padding: 14, gap: 10 },
  // Custom-grid container: slots are absolutely positioned with the gap baked
  // into their coordinates (like the builder), so it must have no padding/gap.
  boardGrid: { padding: 0, gap: 0, position: 'relative' },
  // Filled: content leads — thin, soft border, brighter background.
  slot: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: '#D8D8DC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  // Empty: dashed outline + muted background so filled slots visibly pop next to them.
  slotEmpty: { backgroundColor: C.nested, borderWidth: 2, borderStyle: 'dashed', borderColor: '#ADADAD' },
  slotSelected: { backgroundColor: C.selected, borderColor: C.selBorder, borderWidth: 2, borderStyle: 'solid', shadowColor: C.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
  slotHover: { backgroundColor: C.hovered, borderColor: C.hovBorder, borderWidth: 2, borderStyle: 'solid' },
  // Base size is set per-item via getVisualScale(); shadow is the one constant
  // every cut-out shares. shadowColor/Offset/Opacity/Radius follow the PNG's
  // alpha shape on iOS; elevation is Android's best-effort (rectangular) fallback.
  slotImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  emptySlotContent: { alignItems: 'center', gap: 2 },
  emptySlotPlus: { color: C.sub, fontSize: 18, fontWeight: '300', lineHeight: 20 },
  slotLabel: { color: C.sub, fontSize: 12 },

  // Edit-layout pill pinned to the board's top-left corner (Board tab).
  boardEditBtn: {
    position: 'absolute', top: 8, left: 8, zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#161616',
    borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  boardEditText: { color: '#161616', fontSize: 12, fontWeight: '700' },

  monitorRow: { alignItems: 'center' },
  monitorSlot: { width: '68%', height: 100 },
  middleRow: { flexDirection: 'row', gap: 8 },
  leftCol: { flex: 1, gap: 8 },
  smallRow: { flexDirection: 'row', gap: 8 },
  smallSlot: { flex: 1, height: 90 },
  deskmatSlot: { height: 68 },
  towerSlot: { width: 64, alignSelf: 'stretch' },

  detailPanel: { marginTop: 14, backgroundColor: C.panel, borderRadius: 20, borderWidth: 1, borderColor: C.selBorder, borderTopWidth: 2, padding: 16, gap: 12 },
  detailPanelLabel: { color: C.accent, fontSize: 11, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  detailCard: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  detailPhotoBox: { width: 90, height: 90, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  detailPhoto: { width: 78, height: 78 },
  detailInfo: { flex: 1, gap: 4 },
  detailCategory: { color: C.sub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  detailName: { color: C.text, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  detailBrand: { color: C.accent, fontSize: 13 },
  viewBtn: { marginTop: 8, backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  viewBtnText: { color: C.sub, fontSize: 13, fontWeight: '500' },
  removeRow: { alignItems: 'center', paddingVertical: 2 },
  removeRowText: { color: '#ff453a', fontSize: 13 },

  extrasSection: { marginTop: 20 },
  extrasHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10, paddingHorizontal: 2 },
  extrasTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  extrasSubtitle: { color: C.sub, fontSize: 13 },
  extrasCards: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  // Board tab — Extras row + white Arrange button
  addPeripheralBtnRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  addPeripheralPlusRow: { color: C.sub, fontSize: 20, fontWeight: '300', width: 72, textAlign: 'center' },
  addPeripheralTextRow: { color: C.sub, fontSize: 15 },
  boardActionsRow: { gap: 10, marginTop: 16 },
  postBtn: { borderRadius: 14, backgroundColor: '#161616', paddingVertical: 15, alignItems: 'center' },
  postBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  arrangeBoardBtn: { borderRadius: 14, backgroundColor: '#161616', paddingVertical: 15, alignItems: 'center' },
  arrangeBoardText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  doneText: { color: C.accent, fontSize: 16, fontWeight: '600' },


  // Draggable item tray
  trayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trayCard: {
    width: 88, height: 96, backgroundColor: C.panel, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    padding: 6, gap: 4,
  },
  trayCardPlaced: { opacity: 0.55, borderColor: C.hovBorder },
  trayCardDragging: { opacity: 0.3 },
  trayImg: { width: '80%', height: 56 },
  trayName: { color: C.sub, fontSize: 10, textAlign: 'center' },
  trayDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.hovBorder },
  addPeripheralBtn: {
    width: 88, height: 96, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPeripheralPlus: { color: C.sub, fontSize: 22, fontWeight: '300' },
  addPeripheralText: { color: C.sub, fontSize: 12 },
  arrangeHint: { color: C.sub, fontSize: 12, textAlign: 'center', marginTop: 14, paddingHorizontal: 12, lineHeight: 17 },

  boardGhost: { position: 'absolute', width: 88, height: 88, zIndex: 100, opacity: 0.95 },
  boardGhostImg: { width: '100%', height: '100%' },

  // Slot picker sheet
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: C.panel,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 36, maxHeight: '70%',
  },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
  pickerTitle: { color: C.text, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 14 },
  pickerEmpty: { color: C.sub, fontSize: 13, textAlign: 'center', paddingVertical: 30, paddingHorizontal: 30 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  pickerItem: { width: '30%', alignItems: 'center', gap: 6 },
  pickerThumb: {
    width: '100%', aspectRatio: 1,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pickerThumbImg: { width: '82%', height: '82%' },
  pickerItemName: { color: C.sub, fontSize: 11, textAlign: 'center' },

  // Photo tab
  photoScroll: { flex: 1 },
  photoAreaScroll: {
    width: '100%', aspectRatio: 4 / 3,
    overflow: 'hidden', backgroundColor: C.panel,
  },
  photoItemsSection: { padding: 16, paddingTop: 18, gap: 10 },
  photoTagsLabel: { color: C.sub, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  photoEmptyTags: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  photoEmptyTagsTitle: { color: C.sub, fontSize: 15, fontWeight: '600' },
  photoEmptyTagsHint: { color: '#A8A8AE', fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  // Edit mode — sidebar (photo left, items right)
  photoOuter: { flex: 1 },
  photoOuterTagMode: { padding: 12, paddingBottom: 14 },
  photoInner: { flex: 1 },
  photoInnerRow: { flexDirection: 'row', gap: 10 },
  photoArea: { flex: 1, overflow: 'hidden', backgroundColor: C.panel },
  photoAreaTagMode: { flex: 3, borderRadius: 16 },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoPlaceholderIcon: { color: '#D0D0D5', fontSize: 52 },
  photoPlaceholderText: { color: C.sub, fontSize: 16, fontWeight: '600' },
  photoPlaceholderHint: { color: '#A8A8AE', fontSize: 13 },
  addPhotoBtn: {
    marginTop: 16,
    backgroundColor: C.accent,
    borderRadius: 14, borderWidth: 0,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  addPhotoBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  changePhotoBtn: {
    position: 'absolute', bottom: 14, left: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 7, paddingHorizontal: 14,
  },
  changePhotoBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },

  tagToggle: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  tagToggleOn: {
    backgroundColor: 'rgba(143,184,240,0.13)',
    borderColor: 'rgba(143,184,240,0.42)',
  },
  tagToggleEye: { color: 'rgba(255,255,255,0.65)', fontSize: 15 },
  tagToggleEyeOn: { color: C.accent },
  tagToggleText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  tagToggleTextOn: { color: C.accent },

  listScroll: { padding: 16, paddingBottom: 40 },
  listCards: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  listCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 14, backgroundColor: 'transparent' },
  listCardBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  listPhotoBox: { width: 72, height: 72, backgroundColor: C.card, borderRadius: 10, margin: 10, alignItems: 'center', justifyContent: 'center' },
  listPhoto: { width: 60, height: 60 },
  listInfo: { flex: 1, gap: 4 },
  listBrand: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  listName: { color: C.text, fontSize: 15, fontWeight: '600' },
  listCategory: { color: C.sub, fontSize: 13 },
  listRemoveBtn: { padding: 14, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  listRemoveText: { color: C.sub, fontSize: 16 },
});

// Photo tab component styles
const P = StyleSheet.create({
  // Dot — small, centered on its % coordinate via transform
  dot: {
    position: 'absolute',
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ translateX: -11 }, { translateY: -11 }],
  },
  dotGlow: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
  },
  dotGlowSelected: {
    backgroundColor: 'rgba(143,184,240,0.32)',
    shadowColor: '#8fb8f0',
    shadowOpacity: 0.9,
    shadowRadius: 7,
  },
  dotInner: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#ffffff',
  },
  dotInnerSelected: {
    backgroundColor: '#8fb8f0',
    width: 9, height: 9, borderRadius: 4.5,
  },
  // Item card — compact, anchored near the tapped dot
  card: {
    position: 'absolute',
    width: '58%',
    backgroundColor: 'rgba(20,18,26,0.96)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row', alignItems: 'center',
    padding: 9, gap: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  cardThumb: {
    width: 44, height: 44, borderRadius: 9,
    backgroundColor: '#242428',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardThumbImg: { width: 36, height: 36 },
  cardInfo: { flex: 1, gap: 1 },
  cardBrand: { color: '#8e8e96', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  cardName: { color: '#f5f5f7', fontSize: 12, fontWeight: '700', lineHeight: 15 },
  cardCategory: { color: '#8e8e96', fontSize: 11, marginTop: 1 },
  cardClose: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', flexShrink: 0,
  },
  cardCloseText: { color: '#8e8e96', fontSize: 10 },
  dotRemove: {
    position: 'absolute', top: -5, right: -5,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#ff453a',
    alignItems: 'center', justifyContent: 'center',
  },
  dotRemoveText: { color: '#fff', fontSize: 7, fontWeight: '800', lineHeight: 13 },
});

// Tag placement styles
const T = StyleSheet.create({
  tagPanel: { flex: 2 },
  tagPanelContent: { gap: 8, paddingBottom: 8 },
  tagPanelHint: {
    color: C.sub, fontSize: 11, textAlign: 'center',
    paddingTop: 4, paddingBottom: 8,
    fontWeight: '500', letterSpacing: 0.3,
  },
  draggableCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
    padding: 8, gap: 5,
  },
  draggableCardTagged: {
    borderColor: C.accent,
    backgroundColor: 'rgba(143,184,240,0.06)',
  },
  draggableThumb: {
    width: 52, height: 52,
    backgroundColor: C.nested,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  draggableThumbImg: { width: 44, height: 44 },
  draggableName: {
    color: C.sub, fontSize: 10,
    textAlign: 'center', lineHeight: 13,
  },
  draggableTaggedDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.accent,
  },
  cardGhost: {
    position: 'absolute',
    width: 64, height: 64,
    backgroundColor: C.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.92,
    zIndex: 100,
  },
  cardGhostImg: { width: 54, height: 54 },

  // Tagged item row (shown below photo in view mode)
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  itemRowThumb: { width: 72, height: 72, backgroundColor: C.nested, alignItems: 'center', justifyContent: 'center' },
  itemRowImg: { width: 60, height: 60 },
  itemRowInfo: { flex: 1, paddingHorizontal: 12, gap: 2 },
  itemRowBrand: { color: C.sub, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  itemRowName: { color: C.text, fontSize: 14, fontWeight: '700' },
  itemRowCat: { color: C.sub, fontSize: 12 },
  itemRowChev: { color: C.sub, fontSize: 20, paddingRight: 14 },
});
