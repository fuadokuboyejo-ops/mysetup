import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const LOADING_VIDEO = require('../assets/loadingscreen.mp4');

// The app's loading animation — a looping, muted MP4. Reused for the initial
// launch gate, the AI scan wait, and the AI revamp wait so they all match.
export default function LoadingScreen({ style, contentFit = 'cover' }) {
  const player = useVideoPlayer(LOADING_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, style]}
      contentFit={contentFit}
      nativeControls={false}
      pointerEvents="none"
    />
  );
}
