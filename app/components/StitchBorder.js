import Svg, { Rect } from 'react-native-svg';

// Bold, evenly-spaced dashes with rounded caps — reads like a sketchbook
// stitch line rather than the thin, faint native `borderStyle: 'dashed'`.
export default function StitchBorder({
  width, height, radius = 14,
  color = '#9A9AA0', strokeWidth = 2, dash = 7, gap = 6,
}) {
  if (!width || !height) return null;
  const inset = strokeWidth / 2;
  return (
    <Svg
      width={width} height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Rect
        x={inset} y={inset}
        width={width - strokeWidth} height={height - strokeWidth}
        rx={radius} ry={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash},${gap}`}
        strokeLinecap="round"
      />
    </Svg>
  );
}
