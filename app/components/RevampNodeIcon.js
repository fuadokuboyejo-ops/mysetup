import Svg, { Circle, Line } from 'react-native-svg';

// Revamp nav glyph — a hub node linked to six surrounding nodes (the "connect
// your gear into a setup" motif). Shared by Home's real bottom nav and the
// tutorial's mock nav so the two never drift apart. Drawn as SVG so it stays
// sharp at any size.
export default function RevampNodeIcon({ size = 22, color }) {
  const cx = 12;
  const cy = 12;
  const r = 8;
  const nodes = [0, 60, 120, 180, 240, 300].map(deg => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {nodes.map((n, i) => (
        <Line key={`l${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={color} strokeWidth={1.3} />
      ))}
      {nodes.map((n, i) => (
        <Circle key={`c${i}`} cx={n.x} cy={n.y} r={1.9} fill={color} />
      ))}
      <Circle cx={cx} cy={cy} r={2.5} fill={color} />
    </Svg>
  );
}
