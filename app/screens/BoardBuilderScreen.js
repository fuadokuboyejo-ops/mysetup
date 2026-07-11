import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  PanResponder, Animated,
} from 'react-native';
import { updateSetupLayout } from '../config/setup';
import {
  COLS, MAX_ROWS, GAP, ROW_UNIT,
  shapeSpan, nodeSpan, spanOf, computeLayout, normalizeNodes,
} from '../config/boardLayout';

const C = {
  bg: '#0e0e10', panel: '#1a1a1d', card: '#242428', border: '#2e2e32',
  borderSubtle: 'rgba(255,255,255,0.07)',
  text: '#f5f5f7', sub: '#a0a0a8', accent: '#8fb8f0',
  selBorder: '#4a84d8', selBg: 'rgba(74,132,216,0.12)',
  phBorder: '#4a84d8',
};

const HOLD_MS = 220;
const MOVE_CANCEL_PX = 14;

function snapToCell(relLeft, relTop, span, colW) {
  const { cw } = spanOf(span);
  let col = Math.round((relLeft - GAP) / (colW + GAP));
  let row = Math.round((relTop - GAP) / (ROW_UNIT + GAP));
  col = Math.max(0, Math.min(COLS - cw, col));
  row = Math.max(0, row);
  return { col, row };
}

// ─── Collision handling ───────────────────────────────────────────────────────
// Set of "col,row" cells occupied by the given nodes.
function buildOccupancy(nodeList) {
  const occ = new Set();
  for (const n of nodeList) {
    const { cw, rh } = nodeSpan(n);
    const col = n.col ?? 0, row = n.row ?? 0;
    for (let r = row; r < row + rh; r++) {
      for (let c = col; c < col + cw; c++) occ.add(c + ',' + r);
    }
  }
  return occ;
}

function cellFits(col, row, cw, rh, occ) {
  if (col < 0 || row < 0 || col + cw > COLS) return false;
  for (let r = row; r < row + rh; r++) {
    for (let c = col; c < col + cw; c++) if (occ.has(c + ',' + r)) return false;
  }
  return true;
}

// Nearest free placement (by grid distance) to a preferred cell that doesn't
// overlap any of `otherNodes`. Always succeeds — it can drop onto a fresh row,
// which grows the board.
function resolvePlacement(prefCol, prefRow, span, otherNodes) {
  const { cw, rh } = spanOf(span);
  const col = Math.max(0, Math.min(COLS - cw, prefCol));
  const row = Math.max(0, prefRow);
  const occ = buildOccupancy(otherNodes);
  if (cellFits(col, row, cw, rh, occ)) return { col, row };

  let maxRow = 0;
  for (const n of otherNodes) maxRow = Math.max(maxRow, (n.row ?? 0) + nodeSpan(n).rh);
  const limit = maxRow + rh + 1;

  let best = null, bestDist = Infinity;
  for (let r = 0; r <= limit; r++) {
    for (let c = 0; c <= COLS - cw; c++) {
      if (cellFits(c, r, cw, rh, occ)) {
        const d = Math.abs(c - col) + Math.abs(r - row);
        if (d < bestDist) { bestDist = d; best = { col: c, row: r }; }
      }
    }
  }
  return best ?? { col, row: maxRow };
}

// When row 0 is occupied, shift every other slot down so a new one can sit on top.
function resolveTopInsert(prefCol, span, otherNodes) {
  const { cw, rh } = spanOf(span);
  const col = Math.max(0, Math.min(COLS - cw, prefCol));
  const occ = buildOccupancy(otherNodes);
  if (cellFits(col, 0, cw, rh, occ)) return { col, row: 0, shiftRows: 0 };

  for (let shift = 1; shift <= 12; shift++) {
    const shiftedOcc = buildOccupancy(
      otherNodes.map(n => ({ ...n, row: (n.row ?? 0) + shift })),
    );
    if (cellFits(col, 0, cw, rh, shiftedOcc)) {
      return { col, row: 0, shiftRows: shift };
    }
  }
  return { col, row: 0, shiftRows: 1 };
}

function isTopInsertZone(relY) {
  return relY <= GAP + (ROW_UNIT + GAP) * 1.5;
}

function dropTarget(pageX, pageY, span, otherNodes, boardPos, boardW, nodeList) {
  const { colW } = computeLayout(nodeList, boardW);
  const relX = pageX - boardPos.x;
  const relY = pageY - boardPos.y;
  const { cw, rh } = spanOf(span);
  const relLeft = relX - (cw * colW + (cw - 1) * GAP) / 2;
  const relTop = relY - (rh * ROW_UNIT + (rh - 1) * GAP) / 2;
  const raw = snapToCell(relLeft, relTop, span, colW);

  if (isTopInsertZone(relY)) {
    return resolveTopInsert(raw.col, span, otherNodes);
  }

  const cell = resolvePlacement(raw.col, raw.row, span, otherNodes);
  return { col: cell.col, row: cell.row, shiftRows: 0 };
}

const SHAPE_PRESETS = [
  { key: 'wide',   label: 'Wide'   },
  { key: 'half',   label: 'Half'   },
  { key: 'square', label: 'Square' },
  { key: 'tall',   label: 'Tall'   },
];

export default function BoardBuilderScreen({ setup, onDone, onCancel }) {
  const [nodes, setNodes] = useState(() => normalizeNodes(setup?.boardLayout, setup?.type));
  const [boardW, setBoardW] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [addDrag, setAddDrag] = useState(null);
  const [saving, setSaving] = useState(false);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const dragDataRef = useRef(null);
  const boardWRef = useRef(0);
  const boardRef = useRef(null);
  const boardPagePos = useRef({ x: 0, y: 0 });

  const holdTimerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const dragActiveRef = useRef(false);
  const touchCancelledRef = useRef(false);
  const pressedIdRef = useRef(null);
  const ghostPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const addDragRef = useRef(null);
  const addGhostPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const addDragPRs = useRef({});
  const nameInputRef = useRef(null);
  const pendingNameFocusRef = useRef(false);

  const [nameDraft, setNameDraft] = useState('');

  const resizePRs = useRef({});
  const resizeStartRef = useRef(null);
  const resizingIdRef = useRef(null);
  const lastResizeRef = useRef({ cols: 0, rows: 0 });

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow?.((x, y) => {
      boardPagePos.current = { x, y };
    });
  }, []);

  const onBoardLayout = useCallback((e) => {
    const { width } = e.nativeEvent.layout;
    setBoardW(width);
    boardWRef.current = width;
    setTimeout(measureBoard, 50);
  }, [measureBoard]);

  useEffect(() => {
    if (!selectedId) {
      setNameDraft('');
      return;
    }
    const node = nodesRef.current.find(n => n.id === selectedId);
    setNameDraft(node?.label ?? '');
    if (pendingNameFocusRef.current) {
      pendingNameFocusRef.current = false;
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [selectedId]);

  const renameNode = (id, label) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, label } : n));
  };

  // Which node's rect contains the finger.
  const findNodeAt = useCallback((pageX, pageY) => {
    const bW = boardWRef.current;
    if (!bW) return null;
    const { rects } = computeLayout(nodesRef.current, bW);
    const relX = pageX - boardPagePos.current.x;
    const relY = pageY - boardPagePos.current.y;
    for (const node of nodesRef.current) {
      const r = rects[node.id];
      if (r && relX >= r.x && relX < r.x + r.w && relY >= r.y && relY < r.y + r.h) {
        return node.id;
      }
    }
    return null;
  }, []);

  // Board-relative target cell for the dragged slot, from the current finger pos.
  const dropCell = useCallback((pageX, pageY, node, excludeId = null) => {
    const others = nodesRef.current.filter(n => n.id !== excludeId);
    return dropTarget(
      pageX, pageY, node, others, boardPagePos.current, boardWRef.current, nodesRef.current,
    );
  }, []);

  // ONE PanResponder on the stable board container (never unmounts mid-drag).
  const boardPan = useRef(null);
  if (!boardPan.current) {
    boardPan.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: (e) => {
        if (resizingIdRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        touchStartRef.current = { x: pageX, y: pageY };
        dragActiveRef.current = false;
        touchCancelledRef.current = false;
        measureBoard();

        const pressedId = findNodeAt(pageX, pageY);
        pressedIdRef.current = pressedId;
        if (!pressedId) return; // empty area → deselect on release

        holdTimerRef.current = setTimeout(() => {
          const node = nodesRef.current.find(n => n.id === pressedId);
          const bW = boardWRef.current;
          if (!node || !bW) return;
          measureBoard();

          const { rects } = computeLayout(nodesRef.current, bW);
          const r = rects[pressedId];
          const d = {
            sourceId: pressedId,
            cols: node.cols,
            rows: node.rows,
            shape: node.shape,
            label: node.label,
            ghostW: r.w,
            ghostH: r.h,
            srcCol: node.col ?? 0,   // where the dragged slot started
            srcRow: node.row ?? 0,
            targetCol: node.col ?? 0,
            targetRow: node.row ?? 0,
            shiftRows: 0,
            swapId: null,            // slot we'd trade places with, if any
          };
          dragDataRef.current = d;
          dragActiveRef.current = true;
          ghostPos.setValue({
            x: touchStartRef.current.x - r.w / 2,
            y: touchStartRef.current.y - r.h / 2,
          });
          setDrag(d);
        }, HOLD_MS);
      },

      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;

        if (!dragActiveRef.current) {
          const dx = pageX - touchStartRef.current.x;
          const dy = pageY - touchStartRef.current.y;
          if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
            clearTimeout(holdTimerRef.current);
            touchCancelledRef.current = true;
          }
          return;
        }

        const d = dragDataRef.current;
        if (!d) return;

        ghostPos.setValue({ x: pageX - d.ghostW / 2, y: pageY - d.ghostH / 2 });

        const relY = pageY - boardPagePos.current.y;
        const inTopZone = isTopInsertZone(relY);

        // If the finger is over another slot, we'll swap with it; otherwise snap
        // to the nearest free cell (collision-free move).
        const hoverId = findNodeAt(pageX, pageY);
        const swap = (!inTopZone && hoverId && hoverId !== d.sourceId)
          ? nodesRef.current.find(n => n.id === hoverId)
          : null;

        let swapId, tCol, tRow, tShift;
        if (swap) {
          swapId = swap.id;
          tCol = swap.col ?? 0;
          tRow = swap.row ?? 0;
          tShift = 0;
        } else {
          swapId = null;
          const cell = dropCell(pageX, pageY, d, d.sourceId);
          tCol = cell.col;
          tRow = cell.row;
          tShift = cell.shiftRows;
        }

        if (swapId !== d.swapId || tCol !== d.targetCol || tRow !== d.targetRow || tShift !== d.shiftRows) {
          dragDataRef.current = { ...d, swapId, targetCol: tCol, targetRow: tRow, shiftRows: tShift };
          setDrag(dragDataRef.current);
        }
      },

      onPanResponderRelease: () => {
        clearTimeout(holdTimerRef.current);

        if (dragActiveRef.current && dragDataRef.current) {
          const { sourceId, swapId, srcCol, srcRow, targetCol, targetRow, shiftRows = 0 } = dragDataRef.current;
          setNodes(prev => {
            const A = prev.find(n => n.id === sourceId);
            if (!A) return prev;
            const B = swapId ? prev.find(n => n.id === swapId) : null;

            if (B) {
              const others = prev.filter(n => n.id !== sourceId && n.id !== swapId);
              const aCell = resolvePlacement(B.col ?? 0, B.row ?? 0, A, others);
              const bCell = resolvePlacement(srcCol, srcRow, B, [...others, { ...A, ...aCell }]);
              return prev.map(n => {
                if (n.id === sourceId) return { ...n, ...aCell };
                if (n.id === swapId) return { ...n, ...bCell };
                return n;
              });
            }

            return prev.map(n => {
              if (n.id === sourceId) return { ...n, col: targetCol, row: targetRow };
              if (shiftRows > 0) return { ...n, row: (n.row ?? 0) + shiftRows };
              return n;
            });
          });
          setSelectedId(sourceId);
          dragDataRef.current = null;
          setDrag(null);
          dragActiveRef.current = false;
        } else if (!touchCancelledRef.current) {
          const id = pressedIdRef.current;
          if (id) setSelectedId(prev => prev === id ? null : id);
          else setSelectedId(null);
        }
        pressedIdRef.current = null;
      },

      onPanResponderTerminate: () => {
        clearTimeout(holdTimerRef.current);
        dragDataRef.current = null;
        setDrag(null);
        dragActiveRef.current = false;
        touchCancelledRef.current = false;
        pressedIdRef.current = null;
      },
    });
  }

  const setNodeSize = (id, newCols, newRows) => {
    const cols = Math.max(1, Math.min(COLS, newCols));
    const rows = Math.max(1, Math.min(MAX_ROWS, newRows));
    setNodes(prev => {
      const node = prev.find(n => n.id === id);
      if (!node) return prev;
      const { cw, rh } = nodeSpan(node);
      if (cols === cw && rows === rh) return prev;
      const others = prev.filter(n => n.id !== id);
      const cell = resolvePlacement(node.col ?? 0, node.row ?? 0, { cols, rows }, others);
      return prev.map(n => n.id === id
        ? { ...n, cols, rows, shape: 'custom', col: cell.col, row: cell.row }
        : n);
    });
  };

  const adjustSize = (id, dCols, dRows) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;
    const { cw, rh } = nodeSpan(node);
    setNodeSize(id, cw + dCols, rh + dRows);
  };

  const getResizePR = (nodeId) => {
    if (!resizePRs.current[nodeId]) {
      resizePRs.current[nodeId] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          clearTimeout(holdTimerRef.current);
          touchCancelledRef.current = true;
          resizingIdRef.current = nodeId;
          setSelectedId(nodeId);
          const node = nodesRef.current.find(n => n.id === nodeId);
          const bW = boardWRef.current;
          const { colW } = computeLayout(nodesRef.current, bW);
          const { cw, rh } = nodeSpan(node);
          resizeStartRef.current = {
            cols: cw, rows: rh,
            pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY,
            colW,
          };
          lastResizeRef.current = { cols: cw, rows: rh };
        },
        onPanResponderMove: (e) => {
          const start = resizeStartRef.current;
          if (!start || resizingIdRef.current !== nodeId) return;
          const dx = e.nativeEvent.pageX - start.pageX;
          const dy = e.nativeEvent.pageY - start.pageY;
          const dCols = Math.round(dx / (start.colW + GAP));
          const dRows = Math.round(dy / (ROW_UNIT + GAP));
          const newCols = Math.max(1, Math.min(COLS, start.cols + dCols));
          const newRows = Math.max(1, Math.min(MAX_ROWS, start.rows + dRows));
          if (newCols === lastResizeRef.current.cols && newRows === lastResizeRef.current.rows) return;
          lastResizeRef.current = { cols: newCols, rows: newRows };
          setNodeSize(nodeId, newCols, newRows);
        },
        onPanResponderRelease: () => {
          resizeStartRef.current = null;
          resizingIdRef.current = null;
        },
        onPanResponderTerminate: () => {
          resizeStartRef.current = null;
          resizingIdRef.current = null;
        },
      });
    }
    return resizePRs.current[nodeId];
  };

  const removeNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setSelectedId(null);
  };

  const placeNewNode = (shapeKey, col, row, shiftRows = 0) => {
    const { cw, rh } = shapeSpan(shapeKey);
    const id = 'slot_' + Date.now();
    setNodes(prev => {
      const shifted = shiftRows > 0
        ? prev.map(n => ({ ...n, row: (n.row ?? 0) + shiftRows }))
        : prev;
      return [...shifted, { id, label: '', shape: shapeKey, cols: cw, rows: rh, col, row }];
    });
    pendingNameFocusRef.current = true;
    setSelectedId(id);
    setShowAddPicker(false);
  };

  const getAddDragPR = (preset) => {
    if (!addDragPRs.current[preset.key]) {
      addDragPRs.current[preset.key] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measureBoard();
          const bW = boardWRef.current;
          const { colW } = computeLayout(nodesRef.current, bW);
          const { cw, rh } = shapeSpan(preset.key);
          const ghostW = cw * colW + (cw - 1) * GAP;
          const ghostH = rh * ROW_UNIT + (rh - 1) * GAP;
          const d = {
            shape: preset.key,
            label: preset.label,
            cols: cw,
            rows: rh,
            ghostW,
            ghostH,
            targetCol: 0,
            targetRow: 0,
            shiftRows: 0,
          };
          addDragRef.current = d;
          addGhostPos.setValue({
            x: e.nativeEvent.pageX - ghostW / 2,
            y: e.nativeEvent.pageY - ghostH / 2,
          });
          setAddDrag(d);
        },
        onPanResponderMove: (e) => {
          const d = addDragRef.current;
          if (!d) return;
          const { pageX, pageY } = e.nativeEvent;
          addGhostPos.setValue({ x: pageX - d.ghostW / 2, y: pageY - d.ghostH / 2 });
          const cell = dropCell(pageX, pageY, d);
          if (cell.col !== d.targetCol || cell.row !== d.targetRow || cell.shiftRows !== d.shiftRows) {
            addDragRef.current = { ...d, targetCol: cell.col, targetRow: cell.row, shiftRows: cell.shiftRows };
            setAddDrag(addDragRef.current);
          }
        },
        onPanResponderRelease: (e) => {
          const d = addDragRef.current;
          if (d) {
            const { pageX, pageY } = e.nativeEvent;
            const relX = pageX - boardPagePos.current.x;
            const relY = pageY - boardPagePos.current.y;
            const bW = boardWRef.current;
            const layout = computeLayout(nodesRef.current, bW);
            const topZone = isTopInsertZone(relY);
            const onBoard = bW > 0 && relX >= 0 && relX <= bW
              && (relY >= 0 || topZone) && relY <= layout.height + (d.shiftRows ?? 0) * (ROW_UNIT + GAP);
            if (onBoard) placeNewNode(d.shape, d.targetCol, d.targetRow, d.shiftRows ?? 0);
          }
          addDragRef.current = null;
          setAddDrag(null);
        },
        onPanResponderTerminate: () => {
          addDragRef.current = null;
          setAddDrag(null);
        },
      });
    }
    return addDragPRs.current[preset.key];
  };

  const handleDone = async () => {
    setSaving(true);
    await updateSetupLayout(setup.id, nodes);
    onDone({ ...setup, boardLayout: nodes });
  };

  const selectedNode = nodes.find(n => n.id === selectedId);
  const layout = computeLayout(nodes, boardW);

  const previewShift = drag?.shiftRows ?? addDrag?.shiftRows ?? 0;

  // Placeholder rect (where the dragged slot will land) computed from targetCell.
  let phRect = null;
  let boardHeight = layout.height + previewShift * (ROW_UNIT + GAP);
  if (drag) {
    const { cw, rh } = nodeSpan(drag);
    phRect = {
      x: GAP + drag.targetCol * (layout.colW + GAP),
      y: GAP + drag.targetRow * (ROW_UNIT + GAP),
      w: cw * layout.colW + (cw - 1) * GAP,
      h: rh * ROW_UNIT + (rh - 1) * GAP,
    };
    boardHeight = Math.max(boardHeight, phRect.y + phRect.h + GAP);
  } else if (addDrag && boardW > 0) {
    const { cw, rh } = nodeSpan(addDrag);
    phRect = {
      x: GAP + addDrag.targetCol * (layout.colW + GAP),
      y: GAP + addDrag.targetRow * (ROW_UNIT + GAP),
      w: cw * layout.colW + (cw - 1) * GAP,
      h: rh * ROW_UNIT + (rh - 1) * GAP,
    };
    boardHeight = Math.max(boardHeight, phRect.y + phRect.h + GAP);
  }

  return (
    <View style={S.root}>
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <TouchableOpacity onPress={onCancel} style={S.headerSide}>
          <Text style={S.headerCancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>New setup</Text>
        <TouchableOpacity onPress={handleDone} style={S.headerSide} disabled={saving}>
          <Text style={[S.headerNext, saving && { opacity: 0.5 }]}>Next</Text>
        </TouchableOpacity>
      </View>

      <View style={S.stepRow}>
        <Text style={S.stepActive}>01.  Shape</Text>
        <Text style={S.stepInactive}>    02.  Fill</Text>
      </View>

      <Text style={S.instructions}>hold & drag to move · tap to select · drag blue corner for any width & height</Text>

      {/* collapsable={false} keeps measureInWindow working. The single board-level
          PanResponder owns all gestures; slots are absolutely positioned per the grid. */}
      <View
        ref={boardRef}
        style={[S.board, { height: boardHeight }]}
        onLayout={onBoardLayout}
        collapsable={false}
        {...boardPan.current.panHandlers}
      >
        {boardW > 0 && phRect && (
          <View
            style={[S.placeholder, {
              position: 'absolute',
              left: phRect.x, top: phRect.y, width: phRect.w, height: phRect.h,
            }]}
          />
        )}

        {previewShift > 0 && (
          <View style={[S.topInsertHint, { top: GAP, left: GAP, right: GAP }]} />
        )}

        {boardW > 0 && nodes.map(node => {
          if (drag?.sourceId === node.id) return null; // shown as the ghost instead
          let r = layout.rects[node.id];
          if (!r) return null;

          const shiftPreview = previewShift > 0 && node.id !== drag?.sourceId ? previewShift : 0;
          if (shiftPreview > 0) {
            r = { ...r, y: r.y + shiftPreview * (ROW_UNIT + GAP) };
          }

          // Live swap preview: the partner slides into the dragged slot's old cell.
          if (drag?.swapId === node.id) {
            const { cw, rh } = nodeSpan(node);
            r = {
              x: GAP + drag.srcCol * (layout.colW + GAP),
              y: GAP + drag.srcRow * (ROW_UNIT + GAP),
              w: cw * layout.colW + (cw - 1) * GAP,
              h: rh * ROW_UNIT + (rh - 1) * GAP,
            };
          }
          const isSel = node.id === selectedId;
          const span = nodeSpan(node);
          const labelVertical = span.rh > span.cw;
          return (
            <View
              key={node.id}
              style={[
                S.node,
                { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h },
                isSel && S.nodeSelected,
              ]}
            >
              <View style={S.nodeContent} pointerEvents="none">
                {!labelVertical && <Text style={S.nodePlus}>+</Text>}
                <Text
                  style={[
                    S.nodeLabel,
                    labelVertical && S.nodeLabelRotated,
                    !node.label.trim() && S.nodeLabelPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {node.label.trim() || 'name'}
                </Text>
              </View>
              {isSel && (
                <>
                  <TouchableOpacity
                    style={S.removeBtn}
                    onPress={() => removeNode(node.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={S.removeBtnText}>−</Text>
                  </TouchableOpacity>
                  <View
                    style={S.resizeCorner}
                    {...getResizePR(node.id).panHandlers}
                  />
                </>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[S.addSlotBtn, showAddPicker && S.addSlotBtnActive]}
        onPress={() => { setSelectedId(null); setShowAddPicker(prev => !prev); }}
        activeOpacity={0.8}
      >
        <Text style={[S.addSlotText, showAddPicker && S.addSlotTextActive]}>
          {showAddPicker ? '✕  cancel' : '⊕  add slot'}
        </Text>
      </TouchableOpacity>

      {showAddPicker ? (
        <View style={S.shapePanel}>
          <Text style={S.shapePanelTitle}>NEW SLOT · SIZE</Text>
          <View style={S.shapeRow}>
            {SHAPE_PRESETS.map(p => {
              const dragging = addDrag?.shape === p.key;
              return (
                <View
                  key={p.key}
                  style={[S.shapeBtn, dragging && S.shapeBtnActive]}
                  {...getAddDragPR(p).panHandlers}
                >
                  <View style={[S.shapeIcon, S[`shapeIcon_${p.key}`], dragging && S.shapeIconActive]} />
                  <Text style={[S.shapeBtnLabel, dragging && S.shapeBtnLabelActive]}>{p.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={S.shapePanelFooter}>drag a shape onto the board</Text>
        </View>
      ) : selectedNode ? (() => {
        const span = nodeSpan(selectedNode);
        const displayName = selectedNode.label.trim() || 'untitled';
        return (
          <View style={S.shapePanel}>
            <Text style={S.shapePanelTitle}>SELECTED · {displayName.toUpperCase()}</Text>

            <View style={S.nameRow}>
              <Text style={S.nameLabel}>Name</Text>
              <TextInput
                ref={nameInputRef}
                style={S.nameInput}
                value={nameDraft}
                onChangeText={(text) => {
                  setNameDraft(text);
                  renameNode(selectedId, text);
                }}
                placeholder="monitor, keyboard, mouse…"
                placeholderTextColor="#3a3a44"
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={S.sizeReadout}>{span.cw} wide × {span.rh} tall</Text>
            <Text style={S.shapePanelHint}>Mix any width and height — e.g. tall & skinny or wide & tall</Text>

            <View style={S.dimRow}>
              <Text style={S.dimLabel}>Width</Text>
              <TouchableOpacity
                style={[S.dimBtn, span.cw <= 1 && S.dimBtnDisabled]}
                onPress={() => adjustSize(selectedId, -1, 0)}
                disabled={span.cw <= 1}
              >
                <Text style={S.dimBtnText}>−</Text>
              </TouchableOpacity>
              <View style={S.dimMeter}>
                {Array.from({ length: COLS }, (_, i) => (
                  <View key={i} style={[S.dimMeterCell, i < span.cw && S.dimMeterCellFilled]} />
                ))}
              </View>
              <TouchableOpacity
                style={[S.dimBtn, span.cw >= COLS && S.dimBtnDisabled]}
                onPress={() => adjustSize(selectedId, 1, 0)}
                disabled={span.cw >= COLS}
              >
                <Text style={S.dimBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={S.dimRow}>
              <Text style={S.dimLabel}>Height</Text>
              <TouchableOpacity
                style={[S.dimBtn, span.rh <= 1 && S.dimBtnDisabled]}
                onPress={() => adjustSize(selectedId, 0, -1)}
                disabled={span.rh <= 1}
              >
                <Text style={S.dimBtnText}>−</Text>
              </TouchableOpacity>
              <View style={S.dimMeter}>
                {Array.from({ length: MAX_ROWS }, (_, i) => (
                  <View key={i} style={[S.dimMeterCell, S.dimMeterCellTall, i < span.rh && S.dimMeterCellFilled]} />
                ))}
              </View>
              <TouchableOpacity
                style={[S.dimBtn, span.rh >= MAX_ROWS && S.dimBtnDisabled]}
                onPress={() => adjustSize(selectedId, 0, 1)}
                disabled={span.rh >= MAX_ROWS}
              >
                <Text style={S.dimBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })() : (
        <View style={S.shapePanelPlaceholder}>
          <Text style={S.shapePanelPlaceholderText}>tap add slot · drag a shape onto the board</Text>
        </View>
      )}

    </SafeAreaView>

    {/* Ghost lives outside SafeAreaView so its absolute position is in true
        screen coordinates, matching the PanResponder's pageX/pageY. */}
    {drag && (
      <Animated.View
        pointerEvents="none"
        style={[S.ghost, {
          width: drag.ghostW,
          height: drag.ghostH,
          transform: ghostPos.getTranslateTransform(),
        }]}
      >
        <Text style={S.ghostLabel}>{drag.label}</Text>
      </Animated.View>
    )}
    {addDrag && (
      <Animated.View
        pointerEvents="none"
        style={[S.ghost, {
          width: addDrag.ghostW,
          height: addDrag.ghostH,
          transform: addGhostPos.getTranslateTransform(),
        }]}
      >
        <Text style={S.ghostLabel}>{addDrag.label}</Text>
      </Animated.View>
    )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerSide: { minWidth: 60 },
  headerCancel: { color: C.sub, fontSize: 15 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  headerNext: { color: C.accent, fontSize: 15, fontWeight: '600', textAlign: 'right' },

  stepRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  stepActive: { color: C.text, fontSize: 13, fontWeight: '700' },
  stepInactive: { color: C.sub, fontSize: 13, fontWeight: '500' },

  instructions: { color: C.sub, fontSize: 12, paddingHorizontal: 20, paddingBottom: 12 },

  board: {
    marginHorizontal: 16,
    backgroundColor: C.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    position: 'relative',
  },

  // Matches SetupScreen's board slots: rounded card, dashed "empty slot" border,
  // soft shadow. Selected state swaps to a solid blue border.
  node: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#424248',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  nodeSelected: {
    borderColor: C.selBorder,
    borderWidth: 2,
    borderStyle: 'solid',
    backgroundColor: C.selBg,
  },
  nodeContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  nodePlus: { color: C.sub, fontSize: 18, fontWeight: '300', lineHeight: 20 },
  nodeLabel: { color: C.sub, fontSize: 12, fontWeight: '500' },
  nodeLabelPlaceholder: { color: '#3a3a44', fontStyle: 'italic' },
  nodeLabelRotated: { transform: [{ rotate: '90deg' }] },

  removeBtn: {
    position: 'absolute', top: -8, left: -8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ff3b30',
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 20 },

  resizeCorner: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    backgroundColor: C.selBorder,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#6aa3e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 4,
  },

  placeholder: {
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.phBorder,
    backgroundColor: 'rgba(74,132,216,0.07)',
  },

  topInsertHint: {
    position: 'absolute',
    height: 2,
    backgroundColor: C.accent,
    borderRadius: 1,
    opacity: 0.6,
  },

  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.selBorder,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  ghostLabel: { color: C.text, fontSize: 12, fontWeight: '600' },

  addSlotBtn: {
    marginHorizontal: 16, marginTop: 10,
    paddingVertical: 10,
    backgroundColor: C.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  addSlotBtnActive: { borderColor: C.selBorder, backgroundColor: C.selBg },
  addSlotText: { color: C.sub, fontSize: 13, fontWeight: '500' },
  addSlotTextActive: { color: C.accent },

  shapePanel: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: C.panel,
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12,
  },
  shapePanelTitle: { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  nameRow: { gap: 6 },
  nameLabel: { color: C.sub, fontSize: 12, fontWeight: '600' },
  nameInput: {
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    fontWeight: '500',
  },
  sizeReadout: { color: C.text, fontSize: 15, fontWeight: '700' },
  shapePanelHint: { color: '#3a3a44', fontSize: 12 },

  dimRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dimLabel: { color: C.sub, fontSize: 12, fontWeight: '600', width: 48 },
  dimBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dimBtnDisabled: { opacity: 0.35 },
  dimBtnText: { color: C.text, fontSize: 18, fontWeight: '600', lineHeight: 22 },
  dimMeter: { flex: 1, flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 18 },
  dimMeterCell: { flex: 1, height: 10, borderRadius: 2, backgroundColor: C.border },
  dimMeterCellTall: { height: 18 },
  dimMeterCellFilled: { backgroundColor: C.accent },

  shapeRow: { flexDirection: 'row', gap: 8 },
  shapeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
    gap: 6,
  },
  shapeBtnActive: { borderColor: C.selBorder, backgroundColor: 'rgba(74,132,216,0.1)' },
  shapeBtnLabel: { color: C.sub, fontSize: 11, fontWeight: '500' },
  shapeBtnLabelActive: { color: C.accent },
  shapeIcon: { backgroundColor: C.sub, borderRadius: 2 },
  shapeIconActive: { backgroundColor: C.accent },
  shapeIcon_wide:   { width: 30, height: 12 },
  shapeIcon_half:   { width: 18, height: 12 },
  shapeIcon_square: { width: 14, height: 14 },
  shapeIcon_tall:   { width: 12, height: 24 },
  shapePanelFooter: { color: '#3a3a44', fontSize: 12, textAlign: 'center' },

  shapePanelPlaceholder: {
    marginHorizontal: 16, marginTop: 12, paddingVertical: 20, alignItems: 'center',
  },
  shapePanelPlaceholderText: { color: '#3a3a44', fontSize: 12 },
});
