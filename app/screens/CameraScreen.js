import { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Accelerometer } from 'expo-sensors';
import TutorialOverlay, { useTutorialTarget } from '../components/TutorialOverlay';
import { TUTORIAL_STEPS, useTutorialStep, advanceTutorial, skipTutorial } from '../config/tutorial';

const OUTLINE_SIZES = {
  landscape: { width: '82%', height: '38%' },
  portrait:  { width: '50%', height: '55%' },
  square:    { width: '65%', height: '55%' },
};

export default function CameraScreen({ onPhotoTaken, onBack, productType, productGuide, livePhotoMode }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  // Two-step live photo mode: 'still' → take product photo, 'video' → record wallpaper
  const [liveStep, setLiveStep] = useState('still');
  const [isAligned, setIsAligned] = useState(false);
  // useRef so startRecording always reads the latest value without closure staleness
  const stillBase64Ref = useRef(null);
  const cameraRef = useRef(null);
  // Preview aspect (width/height) — lets the server map the on-screen green guide
  // through the camera's cover-fit crop to the actual recorded video pixels.
  const previewAspectRef = useRef(null);
  // First-run tutorial, step 3: Emo spotlights the shutter. Never during the
  // live-photo flow, and only once the camera is actually usable.
  const shutterStep = useTutorialStep('camera-shutter');
  const tutorialActive = shutterStep.active && !livePhotoMode;
  const shutterTarget = useTutorialTarget(tutorialActive && cameraReady);

  // Reset still when the component enters live photo mode fresh
  useEffect(() => {
    if (livePhotoMode) stillBase64Ref.current = null;
  }, [livePhotoMode]);

  // Accelerometer alignment detection for video step — phone level + facing monitor = green
  useEffect(() => {
    if (!livePhotoMode || liveStep !== 'video') { setIsAligned(false); return; }
    Accelerometer.setUpdateInterval(150);
    const sub = Accelerometer.addListener(({ x, z }) => {
      // x ≈ 0 → not tilted sideways; z ≈ 0 → phone faces monitor (not angled away)
      setIsAligned(Math.abs(x) < 0.18 && Math.abs(z) < 0.28);
    });
    return () => sub.remove();
  }, [livePhotoMode, liveStep]);

  const outline = OUTLINE_SIZES[productGuide?.outline || 'square'];
  const label = productGuide?.label || 'Product';
  const tip = productGuide?.tip || 'center the item, good lighting';

  const isVideoStep = livePhotoMode && liveStep === 'video';

  if (!permission) {
    return <View style={styles.centered}><ActivityIndicator color="#fff" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is needed to scan your setup.</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBack = () => {
    if (livePhotoMode && liveStep === 'video') {
      // Go back to still step so user can retake the product photo
      stillBase64Ref.current = null;
      setLiveStep('still');
    } else {
      onBack();
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.4, base64: true });
      if (livePhotoMode) {
        // Step 1 complete — store still for bg removal, advance to video step
        stillBase64Ref.current = photo.base64;
        setLiveStep('video');
      } else {
        advanceTutorial('camera-shutter'); // the step waits for a real capture
        onPhotoTaken(photo.uri, photo.base64);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !cameraReady || recording) return;
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 5 });
      // Pass video URI + the still base64 captured in step 1 (via ref, never stale),
      // plus the preview aspect so the server can crop precisely to the green guide.
      onPhotoTaken(video.uri, stillBase64Ref.current, { previewAspect: previewAspectRef.current });
    } catch (e) {
      Alert.alert('Error', 'Could not record video. Please try again.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !recording) return;
    cameraRef.current.stopRecording();
    setRecording(false);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      advanceTutorial('camera-shutter'); // gallery counts too — they got a photo
      onPhotoTaken(result.assets[0].uri, result.assets[0].base64);
    }
  };

  // Derived display values
  const displayTitle = livePhotoMode
    ? (liveStep === 'still' ? 'Step 1 — Still photo' : 'Step 2 — Live photo')
    : `Photograph your ${label.toLowerCase()}`;

  const displayTip = livePhotoMode
    ? (liveStep === 'still' ? 'Screen off · fill the frame · used for your item card' : 'Line up the guide with your monitor screen · then record')
    : tip;

  return (
    <View style={styles.container}>
      <View style={styles.cameraStage}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          active
          facing={facing}
          mode={isVideoStep ? 'video' : 'picture'}
          responsiveOrientationWhenOrientationLocked={Platform.OS === 'ios'}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(error) => {
            setCameraReady(false);
            Alert.alert('Camera unavailable', error?.message || 'The camera preview could not start.');
          }}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            if (width && height) previewAspectRef.current = width / height;
          }}
        />
        {!cameraReady && (
          <View style={styles.cameraLoading} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        )}
        <View style={styles.cameraOverlay} pointerEvents="box-none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.topButton}>
            <Text style={styles.topButtonText}>{livePhotoMode && liveStep === 'video' ? '‹' : '✕'}</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{displayTitle}</Text>
          <TouchableOpacity
            onPress={() => {
              setCameraReady(false);
              setFacing(current => (current === 'back' ? 'front' : 'back'));
            }}
            style={styles.topButton}
          >
            <Text style={styles.topButtonText}>⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Step indicator (live photo mode only) */}
        {livePhotoMode && (
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, liveStep === 'video' && styles.stepDotDone]} />
          </View>
        )}

        {/* Tip banner */}
        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>{displayTip}</Text>
        </View>

        {/* LIVE / REC badge (video step only) */}
        {isVideoStep && (
          <View style={[styles.liveBadge, recording && styles.liveBadgeActive]}>
            <Text style={styles.liveBadgeText}>{recording ? '● REC' : '● LIVE'}</Text>
          </View>
        )}

        {/* Monitor alignment guide (live-photo video step only — dormant). No guide
            lines are shown for regular product photos. */}
        {isVideoStep && (
          <View style={styles.overlayContainer}>
            <View style={[styles.monitorGuide, isAligned ? styles.monitorGuideGreen : styles.monitorGuideRed]}>
              {/* Corner markers mimicking monitor bezel */}
              <View style={[styles.mCorner, isAligned ? styles.mCornerGreen : styles.mCornerRed]} />
              <View style={[styles.mCorner, styles.mCornerTR, isAligned ? styles.mCornerGreen : styles.mCornerRed]} />
              <View style={[styles.mCorner, styles.mCornerBL, isAligned ? styles.mCornerGreen : styles.mCornerRed]} />
              <View style={[styles.mCorner, styles.mCornerBR, isAligned ? styles.mCornerGreen : styles.mCornerRed]} />
              <Text style={[styles.alignLabel, isAligned ? styles.alignLabelGreen : styles.alignLabelRed]}>
                {isAligned ? '✓ Lined up' : 'Align with monitor screen'}
              </Text>
            </View>
          </View>
        )}

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {!isVideoStep ? (
            <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
              <Text style={styles.galleryIcon}>🖼</Text>
              <Text style={styles.galleryLabel}>Gallery</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.galleryButton} />
          )}

          {isVideoStep ? (
            <TouchableOpacity
              style={[styles.shutterButton, styles.recordButton, recording && styles.recordingActive]}
              onPress={recording ? stopRecording : startRecording}
            >
              {recording
                ? <View style={styles.recordStop} />
                : <View style={styles.recordDot} />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              ref={shutterTarget.ref}
              onLayout={shutterTarget.onLayout}
              style={[styles.shutterButton, capturing && styles.shutterDisabled]}
              onPress={takePhoto}
              disabled={capturing}
            >
              {capturing
                ? <ActivityIndicator color="#0F0F0F" />
                : <View style={styles.shutterInner} />}
            </TouchableOpacity>
          )}

          <View style={styles.galleryButton} />
        </View>
        </View>
      </View>

      {tutorialActive && (
        <TutorialOverlay
          steps={TUTORIAL_STEPS}
          stepIndex={shutterStep.stepIndex}
          targetRect={shutterTarget.rect}
          onSkip={skipTutorial}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  cameraStage: { flex: 1, position: 'relative', overflow: 'hidden' },
  camera: { ...StyleSheet.absoluteFillObject },
  cameraOverlay: { flex: 1, justifyContent: 'space-between' },
  cameraLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  topButton: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  topButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  topTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
    gap: 0,
  },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stepDotDone: { backgroundColor: '#fff' },
  stepLine: {
    width: 28, height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 10,
  },
  tipText: { color: '#fff', fontSize: 13 },

  liveBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  liveBadgeActive: { backgroundColor: 'rgba(255,59,48,0.7)' },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  overlayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 1.5,
    borderColor: '#8fb8f0',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute', top: -2, left: -2,
    width: 20, height: 20,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderColor: '#fff', borderRadius: 2,
  },
  cornerTR: { left: undefined, right: -2, borderLeftWidth: 0, borderRightWidth: 3 },
  cornerBL: { top: undefined, bottom: -2, borderTopWidth: 0, borderBottomWidth: 3 },
  cornerBR: { top: undefined, bottom: -2, left: undefined, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  alignText: { color: '#8fb8f0', fontSize: 13, letterSpacing: 0.3 },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  galleryButton: { alignItems: 'center', width: 60 },
  galleryIcon: { fontSize: 30 },
  galleryLabel: { color: '#fff', fontSize: 11, marginTop: 4 },
  shutterButton: {
    width: 76, height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
  },
  shutterDisabled: { opacity: 0.5 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },

  // Monitor alignment guide (video step)
  monitorGuide: {
    width: '90%',
    aspectRatio: 16 / 9,
    borderWidth: 2.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorGuideGreen: { borderColor: '#4CD964' },
  monitorGuideRed: { borderColor: '#FF3B30' },

  mCorner: {
    position: 'absolute', top: -3, left: -3,
    width: 24, height: 24,
    borderTopWidth: 4, borderLeftWidth: 4,
    borderRadius: 3,
  },
  mCornerGreen: { borderColor: '#4CD964' },
  mCornerRed: { borderColor: '#FF3B30' },
  mCornerTR: { left: undefined, right: -3, borderLeftWidth: 0, borderRightWidth: 4 },
  mCornerBL: { top: undefined, bottom: -3, borderTopWidth: 0, borderBottomWidth: 4 },
  mCornerBR: { top: undefined, bottom: -3, left: undefined, right: -3, borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 4, borderRightWidth: 4 },

  alignLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  alignLabelGreen: { color: '#4CD964' },
  alignLabelRed: { color: '#FF3B30' },

  recordButton: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: '#FF3B30' },
  recordingActive: { backgroundColor: 'rgba(255,59,48,0.25)', borderColor: '#FF3B30' },
  recordDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF3B30' },
  recordStop: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#FF3B30' },

  permissionContainer: {
    flex: 1, backgroundColor: '#0F0F0F',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 20,
  },
  permissionText: { color: '#aaa', fontSize: 16, textAlign: 'center' },
  permButton: {
    backgroundColor: '#fff', paddingVertical: 14,
    paddingHorizontal: 32, borderRadius: 12,
  },
  permButtonText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
  backLink: { color: '#555', fontSize: 14 },
});
