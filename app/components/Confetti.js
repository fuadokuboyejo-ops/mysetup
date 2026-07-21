import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

// One-shot confetti rain, pure Animated — no dependency. Each piece gets a
// random column, drift, spin, and fall time, so the burst reads organic.
const COLORS = ['#6D5EF0', '#8FD4E8', '#F2B84B', '#E86A5E', '#7BC47F', '#F49AC1', '#FFFFFF'];

export default function Confetti({ count = 26 }) {
  const { width, height } = useWindowDimensions();
  const pieces = useRef(
    Array.from({ length: count }, (_, index) => ({
      progress: new Animated.Value(0),
      x: Math.random() * width,
      delay: Math.random() * 450,
      duration: 1500 + Math.random() * 900,
      drift: (Math.random() - 0.5) * 140,
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
      size: 7 + Math.random() * 7,
      color: COLORS[index % COLORS.length],
      round: Math.random() < 0.35,
    })),
  ).current;

  useEffect(() => {
    pieces.forEach(piece => {
      Animated.timing(piece.progress, {
        toValue: 1,
        duration: piece.duration,
        delay: piece.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
        isInteraction: false,
      }).start();
    });
  }, [pieces]);

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: piece.x,
            top: -24,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 1.7,
            borderRadius: piece.round ? piece.size / 2 : 2,
            backgroundColor: piece.color,
            opacity: piece.progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.95] }) },
              { translateX: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
              { rotate: piece.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </Animated.View>
  );
}
