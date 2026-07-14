import { View } from 'react-native';

// A jagged, comic-sticker "splat" shape built from overlapping circles —
// the same motif behind icons in reference designs, without needing SVG path math.
const PETALS = [
  { x: 0.50, y: 0.08, r: 0.34 },
  { x: 0.86, y: 0.30, r: 0.30 },
  { x: 0.90, y: 0.68, r: 0.32 },
  { x: 0.60, y: 0.94, r: 0.30 },
  { x: 0.22, y: 0.90, r: 0.32 },
  { x: 0.06, y: 0.56, r: 0.30 },
  { x: 0.14, y: 0.20, r: 0.30 },
];

export default function ComicBurst({ size = 92, color = '#DCEDEA' }) {
  return (
    <View style={{ width: size, height: size, position: 'absolute' }} pointerEvents="none">
      <View style={{
        position: 'absolute',
        width: size * 0.7, height: size * 0.7,
        left: size * 0.15, top: size * 0.15,
        borderRadius: size,
        backgroundColor: color,
      }} />
      {PETALS.map((p, i) => {
        const d = size * p.r;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: d, height: d,
              left: size * p.x - d / 2,
              top: size * p.y - d / 2,
              borderRadius: d,
              backgroundColor: color,
            }}
          />
        );
      })}
    </View>
  );
}
