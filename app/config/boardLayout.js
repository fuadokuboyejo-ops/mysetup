// Shared grid model for board builder + setup board view.

export const COLS = 6;
export const MAX_ROWS = 4;
export const GAP = 8;
export const ROW_UNIT = 58;

const MONITOR_KEYWORDS = ['monitor', 'display', 'screen', 'tv'];

export function shapeSpan(shape) {
  switch (shape) {
    case 'wide':   return { cw: 4, rh: 1 };
    case 'half':   return { cw: 3, rh: 1 };
    case 'square': return { cw: 2, rh: 1 };
    case 'tall':   return { cw: 2, rh: 2 };
    default:       return { cw: 2, rh: 1 };
  }
}

export function nodeSpan(node) {
  if (Number.isFinite(node?.cols) && Number.isFinite(node?.rows)) {
    return {
      cw: Math.max(1, Math.min(COLS, node.cols)),
      rh: Math.max(1, Math.min(MAX_ROWS, node.rows)),
    };
  }
  return shapeSpan(node?.shape);
}

export function spanOf(nodeOrShape) {
  if (typeof nodeOrShape === 'string') return shapeSpan(nodeOrShape);
  return nodeSpan(nodeOrShape);
}

export function computeLayout(nodeList, boardW) {
  if (!boardW) return { rects: {}, height: ROW_UNIT * 3 + GAP * 4, colW: 0 };
  const innerW = boardW - 2 * GAP;
  const colW = (innerW - (COLS - 1) * GAP) / COLS;
  const rects = {};
  let maxRows = 0;
  for (const node of nodeList) {
    const { cw, rh } = nodeSpan(node);
    const col = node.col ?? 0;
    const row = node.row ?? 0;
    rects[node.id] = {
      x: GAP + col * (colW + GAP),
      y: GAP + row * (ROW_UNIT + GAP),
      w: cw * colW + (cw - 1) * GAP,
      h: rh * ROW_UNIT + (rh - 1) * GAP,
    };
    maxRows = Math.max(maxRows, row + rh);
  }
  const rows = Math.max(maxRows, 3);
  return { rects, height: rows * ROW_UNIT + (rows + 1) * GAP, colW };
}

// PC / default board.
export const DEFAULT_NODES = [
  { id: 'monitor',  label: 'monitor',  shape: 'half', cols: 3, rows: 1, col: 0, row: 0 },
  { id: 'keyboard', label: 'keyboard', shape: 'square', cols: 2, rows: 1, col: 0, row: 1 },
  { id: 'mouse',    label: 'mouse',    shape: 'square', cols: 2, rows: 1, col: 2, row: 1 },
  { id: 'pc_tower', label: 'PC tower', shape: 'tall',   cols: 2, rows: 2, col: 4, row: 1 },
  { id: 'deskmat',  label: 'deskmat',  shape: 'wide',   cols: 4, rows: 1, col: 0, row: 2 },
];

// Server board — six 3-column rectangle slots, two per row across three rows.
const SERVER_NODES = [
  { id: 'server_1', label: 'server 1', shape: 'half', cols: 3, rows: 1, col: 0, row: 0 },
  { id: 'server_2', label: 'server 2', shape: 'half', cols: 3, rows: 1, col: 3, row: 0 },
  { id: 'server_3', label: 'server 3', shape: 'half', cols: 3, rows: 1, col: 0, row: 1 },
  { id: 'server_4', label: 'server 4', shape: 'half', cols: 3, rows: 1, col: 3, row: 1 },
  { id: 'server_5', label: 'server 5', shape: 'half', cols: 3, rows: 1, col: 0, row: 2 },
  { id: 'server_6', label: 'server 6', shape: 'half', cols: 3, rows: 1, col: 3, row: 2 },
];

// Laptop board — laptop (2×2) top-left, wide monitor top-right, mouse + keyboard below.
const LAPTOP_NODES = [
  { id: 'laptop',   label: 'laptop',   shape: 'tall',   cols: 2, rows: 2, col: 0, row: 0 },
  { id: 'monitor',  label: 'monitor',  shape: 'half',   cols: 3, rows: 1, col: 3, row: 0 },
  { id: 'mouse',    label: 'mouse',    shape: 'square', cols: 2, rows: 1, col: 2, row: 1 },
  { id: 'keyboard', label: 'keyboard', shape: 'square', cols: 2, rows: 1, col: 4, row: 1 },
];

// Each setup type gets its own starter board. Falls back to the PC board.
const DEFAULT_NODES_BY_TYPE = {
  pc: DEFAULT_NODES,
  server: SERVER_NODES,
  laptop: LAPTOP_NODES,
};

export function defaultNodesForType(type) {
  return DEFAULT_NODES_BY_TYPE[type] || DEFAULT_NODES;
}

function withSpan(node) {
  const { cw, rh } = nodeSpan(node);
  return { ...node, cols: cw, rows: rh };
}

// `type` picks the starter board when there's no saved layout yet.
export function normalizeNodes(saved, type) {
  const fallback = defaultNodesForType(type);
  if (!saved?.length) return fallback.map(withSpan);
  if (saved.every(n => Number.isFinite(n.col) && Number.isFinite(n.row))) {
    return saved.map(withSpan);
  }
  return fallback.map(withSpan);
}

export function isMonitorNode(node) {
  const text = `${node?.id || ''} ${node?.label || ''}`.toLowerCase();
  return MONITOR_KEYWORDS.some(k => text.includes(k));
}

/** Match scanned items to custom board slot nodes by id, label, or category defs. */
export function matchItemsToLayout(items, nodes, slotDefs, manualSlots = {}) {
  const slots = {};
  const used = new Set();

  for (const node of nodes) {
    if (manualSlots[node.id]) {
      slots[node.id] = manualSlots[node.id];
      used.add(manualSlots[node.id].id);
    }
  }

  for (const node of nodes) {
    if (slots[node.id]) continue;
    const def = slotDefs.find(s => s.key === node.id);
    if (!def) continue;
    for (const item of items) {
      if (used.has(item.id)) continue;
      const cat = (item.product?.category || '').toLowerCase();
      const name = (item.product?.product_name || '').toLowerCase();
      if (def.categories.some(c => cat.includes(c) || name.includes(c))) {
        slots[node.id] = item;
        used.add(item.id);
        break;
      }
    }
  }

  for (const node of nodes) {
    if (slots[node.id]) continue;
    const label = (node.label || '').toLowerCase().trim();
    if (!label) continue;
    for (const item of items) {
      if (used.has(item.id)) continue;
      const cat = (item.product?.category || '').toLowerCase();
      const name = (item.product?.product_name || '').toLowerCase();
      const words = label.split(/\s+/).filter(w => w.length > 2);
      const matches = cat.includes(label) || name.includes(label)
        || words.some(w => cat.includes(w) || name.includes(w));
      if (matches) {
        slots[node.id] = item;
        used.add(item.id);
        break;
      }
    }
  }

  return slots;
}
