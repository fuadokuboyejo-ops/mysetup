import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingScreen from './screens/OnboardingScreen';
import OnboardingBoardScreen from './screens/OnboardingBoardScreen';
import OnboardingCameraScreen from './screens/OnboardingCameraScreen';
import OnboardingAIRevampScreen from './screens/OnboardingAIRevampScreen';
import OnboardingSetupTypeScreen from './screens/OnboardingSetupTypeScreen';
import OnboardingStyleScreen from './screens/OnboardingStyleScreen';
import OnboardingAccountScreen from './screens/OnboardingAccountScreen';
import OnboardingFounderScreen from './screens/OnboardingFounderScreen';
import OnboardingBuildSetupScreen from './screens/OnboardingBuildSetupScreen';
import { createSetup, getIsPremium, addSetupItem } from './config/setup';
import { API_BASE } from './config/api';
import HomeScreen from './screens/HomeScreen';
import ProductPickerScreen from './screens/ProductPickerScreen';
import CameraScreen from './screens/CameraScreen';
import BoardBuilderScreen from './screens/BoardBuilderScreen';
import GearReceiptScreen from './screens/GearReceiptScreen';
import SetupScreen from './screens/SetupScreen';
import ProfileScreen from './screens/ProfileScreen';
import RevampMenuScreen from './screens/RevampMenuScreen';
import RevampCameraRollScreen from './screens/RevampCameraRollScreen';
import RevampScreen from './screens/RevampScreen';
import RevampPaywallScreen from './screens/RevampPaywallScreen';

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [saving, setSaving] = useState(false);
  const [productType, setProductType] = useState(null);
  const [productGuide, setProductGuide] = useState(null);
  const [activeSetup, setActiveSetup] = useState(null);
  const [setupInitialView, setSetupInitialView] = useState('board');
  const [isPremium, setIsPremiumState] = useState(false);
  // Where board-builder sends you once you finish — the normal build flow
  // (onboarding, Profile → Build Setup) lands on the setup screen; AI Revamp's
  // "Design from scratch" instead sends you to the Generate screen.
  const [afterBoardBuilder, setAfterBoardBuilder] = useState('setup');
  // Where the setup screen's back button sends you — normally Profile, but
  // "Arrange board" from the Generate screen should return you there.
  const [afterSetup, setAfterSetup] = useState('profile');
  // A photo of the user's setup chosen for "Try different gear" (camera roll,
  // camera, or a saved setup's photo) — null for the "Design from scratch" path.
  const [revampBasePhoto, setRevampBasePhoto] = useState(null);
  const [revampAutoGenerate, setRevampAutoGenerate] = useState(false);
  const [revampDraftPhoto, setRevampDraftPhoto] = useState(null);
  const [revampDraftSetup, setRevampDraftSetup] = useState(null);

  useEffect(() => { getIsPremium().then(setIsPremiumState); }, []);

  const openRevamp = () => setScreen(isPremium ? 'revamp-menu' : 'revamp-paywall');

  // ── Adding a scanned / manually-entered item to the library ────────────────
  // (Replaces the old Results screen.) Runs the background cutout, saves the
  // item, then returns to the picker so the user can scan the next thing.
  const attemptCutout = async (photo) => {
    try {
      const res = await fetch(`${API_BASE}/api/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image) return data.image;
      }
    } catch {
      // fall through to the retry / skip prompt below
    }
    return null;
  };

  const finishAddItem = async (product, image, isCutout) => {
    try {
      await addSetupItem(activeSetup?.id || 'default', product, image, isCutout);
      setScreen('picker');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const addScannedItem = async (product) => {
    setSaving(true);
    const cutImage = await attemptCutout(photoBase64);
    if (cutImage) {
      await finishAddItem(product, cutImage, true);
      return;
    }
    // Background removal failed — some products (monitors/displays) fill the
    // frame with no isolated foreground. Ask instead of silently keeping the
    // raw photo: items without a real cutout can't go on the board yet.
    setSaving(false);
    Alert.alert(
      "Couldn't cut out background",
      'This item will still be saved to your library, but it needs a clean cutout before it can go on your board.',
      [
        { text: 'Try again', onPress: () => addScannedItem(product) },
        { text: 'Save without cutout', onPress: () => { setSaving(true); finishAddItem(product, photoBase64, false); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  // Monitors are captured as a regular photo, same as any other product.
  // (Live monitor wallpaper is shelved — see FUTURE_UPDATES.md.)
  const goToCamera = (type, guide) => {
    setProductType(type);
    setProductGuide(guide);
    setScreen('camera');
  };

  const openSetup = (setup) => {
    setActiveSetup(setup);
    setSetupInitialView('board');
    setScreen('setup');
  };

  const handleSetupDeleted = (setupId) => {
    if (activeSetup?.id === setupId) setActiveSetup(null);
  };

  const buildSetup = (setup) => {
    setActiveSetup(setup);
    setScreen('board-builder');
  };

  const startFirstBuild = async () => {
    const setup = await createSetup('My Setup', 'pc');
    setActiveSetup(setup);
    setScreen('board-builder');
  };

  const designFromScratch = async () => {
    setRevampBasePhoto(null);
    setRevampAutoGenerate(false);
    const setup = await createSetup('My Setup', 'pc');
    setActiveSetup(setup);
    setAfterBoardBuilder('revamp');
    setScreen('board-builder');
  };

  const arrangeBoard = () => {
    setSetupInitialView('board');
    setAfterSetup('revamp');
    setScreen('setup');
  };

  const openRevampCameraRoll = () => {
    setRevampDraftPhoto(null);
    setRevampDraftSetup(null);
    setScreen('revamp-camera-roll');
  };

  const getOrCreateRevampDraftSetup = async () => {
    if (revampDraftSetup) return revampDraftSetup;
    const setup = await createSetup('Photo Revamp', 'pc');
    setRevampDraftSetup(setup);
    return setup;
  };

  const editRevampDraftBoard = async () => {
    const setup = await getOrCreateRevampDraftSetup();
    setActiveSetup(setup);
    setAfterBoardBuilder('revamp-camera-roll');
    setScreen('board-builder');
  };

  const arrangeRevampDraftBoard = async () => {
    const setup = await getOrCreateRevampDraftSetup();
    setActiveSetup(setup);
    setSetupInitialView('board');
    setAfterSetup('revamp-camera-roll');
    setScreen('setup');
  };

  const continueCameraRollRevamp = async (photo) => {
    const setup = await getOrCreateRevampDraftSetup();
    setActiveSetup(setup);
    setRevampBasePhoto(photo);
    setRevampAutoGenerate(true);
    setScreen('revamp');
  };

  function renderScreen() {
    if (screen === 'onboarding') {
      return (
        <OnboardingScreen
          onContinue={() => setScreen('onboarding-board')}
          onBack={() => setScreen('home')}
        />
      );
    }
    if (screen === 'onboarding-board') {
      return (
        <OnboardingBoardScreen
          onContinue={() => setScreen('onboarding-camera')}
          onBack={() => setScreen('onboarding')}
        />
      );
    }
    if (screen === 'onboarding-camera') {
      return (
        <OnboardingCameraScreen
          onContinue={() => setScreen('onboarding-ai-revamp')}
          onBack={() => setScreen('onboarding-board')}
        />
      );
    }
    if (screen === 'onboarding-ai-revamp') {
      return (
        <OnboardingAIRevampScreen
          onContinue={() => setScreen('onboarding-setup-type')}
          onBack={() => setScreen('onboarding-camera')}
        />
      );
    }
    if (screen === 'onboarding-setup-type') {
      return (
        <OnboardingSetupTypeScreen
          onContinue={(data) => setScreen('onboarding-style')}
          onBack={() => setScreen('onboarding-ai-revamp')}
        />
      );
    }
    if (screen === 'onboarding-style') {
      return (
        <OnboardingStyleScreen
          onContinue={(data) => setScreen('onboarding-account')}
          onBack={() => setScreen('onboarding-setup-type')}
        />
      );
    }
    if (screen === 'onboarding-account') {
      return (
        <OnboardingAccountScreen
          onContinue={(data) => setScreen('onboarding-founder')}
          onBack={() => setScreen('onboarding-style')}
        />
      );
    }
    if (screen === 'onboarding-founder') {
      return (
        <OnboardingFounderScreen
          onContinue={() => setScreen('onboarding-build-setup')}
        />
      );
    }
    if (screen === 'onboarding-build-setup') {
      return (
        <OnboardingBuildSetupScreen
          onContinue={startFirstBuild}
          onSkip={() => setScreen('home')}
        />
      );
    }
    if (screen === 'picker') {
      return (
        <ProductPickerScreen
          onSelect={(type, guide) => goToCamera(type, guide)}
          onBack={() => setScreen(activeSetup ? 'setup' : 'home')}
          onGoToLibrary={() => setScreen('profile')}
          onPhotoPicked={(uri, base64, type, guide) => {
            setProductType(type);
            setProductGuide(guide);
            setPhotoUri(uri);
            setPhotoBase64(base64);
            setScreen('preview');
          }}
          isPremium={isPremium}
          onRequirePremium={() => setScreen('revamp-paywall')}
        />
      );
    }
    if (screen === 'camera') {
      return (
        <CameraScreen
          onPhotoTaken={(uri, base64) => {
            setPhotoUri(uri);
            setPhotoBase64(base64);
            setScreen('preview');
          }}
          onBack={() => setScreen('picker')}
          productType={productType}
          productGuide={productGuide}
        />
      );
    }
    if (screen === 'board-builder') {
      return (
        <BoardBuilderScreen
          setup={activeSetup}
          onDone={(setup) => {
            setActiveSetup(setup);
            if (afterBoardBuilder === 'revamp-camera-roll') setRevampDraftSetup(setup);
            setScreen(afterBoardBuilder);
            setAfterBoardBuilder('setup');
          }}
          onCancel={() => {
            if (afterBoardBuilder === 'revamp-camera-roll') {
              setScreen('revamp-camera-roll');
              setAfterBoardBuilder('setup');
            } else {
              setScreen('profile');
            }
          }}
        />
      );
    }
    if (screen === 'preview') {
      return (
        <GearReceiptScreen
          photoUri={photoUri}
          photoBase64={photoBase64}
          productType={productType}
          onResults={(product, uri) => { setPhotoUri(uri); addScannedItem(product); }}
          onBack={() => setScreen('picker')}
        />
      );
    }
    if (screen === 'setup') {
      return (
        <SetupScreen
          setup={activeSetup}
          initialView={setupInitialView}
          autoArrange={afterSetup === 'revamp' || afterSetup === 'revamp-camera-roll'}
          onBack={() => { setScreen(afterSetup); setAfterSetup('profile'); }}
          onScanMore={() => setScreen('picker')}
          onEditBoard={() => { setAfterBoardBuilder('setup'); setScreen('board-builder'); }}
          onDelete={() => {
            setActiveSetup(null);
            setScreen('profile');
          }}
        />
      );
    }
    if (screen === 'revamp-menu') {
      return (
        <RevampMenuScreen
          onBack={() => setScreen('home')}
          onDesignFromScratch={designFromScratch}
          onDifferentGear={(photo) => { setRevampBasePhoto(photo || null); setRevampAutoGenerate(false); setScreen('revamp'); }}
          onCameraRoll={openRevampCameraRoll}
          onExistingSetup={() => setScreen('profile')}
        />
      );
    }
    if (screen === 'revamp-camera-roll') {
      return (
        <RevampCameraRollScreen
          photo={revampDraftPhoto}
          setup={revampDraftSetup}
          onPhotoChange={setRevampDraftPhoto}
          onBack={() => setScreen('revamp-menu')}
          onEditBoard={editRevampDraftBoard}
          onArrangeBoard={arrangeRevampDraftBoard}
          onContinue={continueCameraRollRevamp}
        />
      );
    }
    if (screen === 'revamp') {
      return (
        <RevampScreen
          setup={activeSetup}
          basePhoto={revampBasePhoto}
          autoGenerate={revampAutoGenerate}
          onAutoGenerateStarted={() => setRevampAutoGenerate(false)}
          onBack={() => { setRevampAutoGenerate(false); setScreen('revamp-menu'); }}
          onArrangeBoard={arrangeBoard}
        />
      );
    }
    if (screen === 'revamp-paywall') {
      return (
        <RevampPaywallScreen
          onUnlock={() => { setIsPremiumState(true); setScreen('revamp-menu'); }}
          onBack={() => setScreen('home')}
        />
      );
    }
    if (screen === 'profile') {
      return (
        <ProfileScreen
          onOpenSetup={openSetup}
          onBuildSetup={buildSetup}
          onBack={() => setScreen('home')}
          onSetupDeleted={handleSetupDeleted}
        />
      );
    }
    return (
      <HomeScreen
        onStartScan={() => setScreen('picker')}
        onViewSetup={() => setScreen('profile')}
        onRevamp={openRevamp}
      />
    );
  }

  return (
    <SafeAreaProvider>
      {renderScreen()}
      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.savingText}>Adding to your setup…</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  savingText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
