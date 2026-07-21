import { useState, useEffect } from 'react';
import { View, Alert, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as Linking from 'expo-linking';
import LoadingScreen from './components/LoadingScreen';
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
import { supabase } from './config/supabase';
import { handleAuthRedirect } from './config/auth';
import { imageUri } from './config/media';
import {
  TUTORIAL_STEPS, initTutorial, advanceTutorial, jumpTutorial, completeTutorial,
  skipTutorial, isTutorialActive, useTutorialState,
} from './config/tutorial';
import TutorialCelebration from './components/TutorialCelebration';
import TutorialEndScreen from './screens/TutorialEndScreen';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import ProductPickerScreen from './screens/ProductPickerScreen';
import CameraScreen from './screens/CameraScreen';
import BoardBuilderScreen from './screens/BoardBuilderScreen';
import GearReceiptScreen from './screens/GearReceiptScreen';
import SetupScreen from './screens/SetupScreen';
import ProfileScreen from './screens/ProfileScreen';
import RevampMenuScreen from './screens/RevampMenuScreen';
import RevampSetupPickerScreen from './screens/RevampSetupPickerScreen';
import RevampCameraRollScreen from './screens/RevampCameraRollScreen';
import RevampScreen from './screens/RevampScreen';
import RevampPaywallScreen from './screens/RevampPaywallScreen';

const LOADING_SCREEN = require('./assets/loadingscreen.mp4');

// Warmed up on launch so the branding/onboarding media doesn't pop in. The
// loading screen shows while these download (they're served over the network in
// Expo Go on first use).
const PRELOAD_ASSETS = [
  LOADING_SCREEN,
  require('./assets/mascot.gif'),
  require('./assets/mascot_head.png'),
  require('./assets/onboarding_1.mp4'),
  require('./assets/peeking_bot.png'),
  require('./assets/end_of_tutorial.gif'),
  require('./assets/end_of_tutorail_loop.gif'),
  require('./assets/board.gif'),
  require('./assets/camera.gif'),
  require('./assets/airevamp.gif'),
  require('./assets/buildboard.gif'),
  require('./assets/paywall.gif'),
  require('./assets/subscreen.gif'),
];

// Dev-only: start on the onboarding flow even when a session already exists, so
// the whole first-run journey (onboarding → tutorial) can be walked without
// signing out. Set to false for normal signed-in launches. Ignored in prod.
const DEV_FORCE_ONBOARDING = true;

export default function App() {
  // Gate the app behind an initial asset-preload + setup load.
  const [ready, setReady] = useState(false);
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
  // First-run tutorial: the user's first cutout, held for the celebration
  // moments ("background gone ✨" → board drop → all set).
  const [tutorialCutout, setTutorialCutout] = useState(null);
  const tutorial = useTutorialState();
  const tutorialStepId = tutorial.status === 'active' ? TUTORIAL_STEPS[tutorial.stepIndex]?.id : null;

  // The tutorial starts the first time the user lands on the feed — after
  // onboarding or straight away for returning-but-untutored accounts.
  useEffect(() => {
    if (ready && screen === 'home') initTutorial();
  }, [ready, screen]);

  useEffect(() => {
    let active = true;

    const prepareApp = async () => {
      // Download each asset as its own task. Promise.allSettled keeps the loading
      // screen mounted until every download has either completed or failed;
      // one bad asset can no longer reveal the app while the others are loading.
      const assetTasks = PRELOAD_ASSETS.map(module => Asset.fromModule(module).downloadAsync());
      const [assetResults, sessionResult] = await Promise.all([
        Promise.allSettled(assetTasks),
        supabase.auth.getSession(),
      ]);
      if (!active) return;

      const session = sessionResult.data?.session || null;
      if (session) {
        try {
          setIsPremiumState(await getIsPremium());
        } catch (error) {
          console.warn('[app] premium status load failed:', error.message);
        }
        // Dev flag keeps you on the onboarding flow to test the full first-run.
        if (!(__DEV__ && DEV_FORCE_ONBOARDING)) setScreen('home');
      }

      assetResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`[app] asset preload failed at index ${index}:`, result.reason?.message || result.reason);
        }
      });
      setReady(true);
    };

    prepareApp();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const openAuthLink = async (url) => {
      const result = await handleAuthRedirect(url);
      if (!active || !result.handled) return;
      if (result.error) {
        Alert.alert('Email verification failed', result.error);
        return;
      }
      if (result.session) {
        try {
          setIsPremiumState(await getIsPremium());
        } catch {
          setIsPremiumState(false);
        }
        setScreen(current => current === 'onboarding-account' ? 'onboarding-founder' : 'home');
      }
    };

    Linking.getInitialURL().then(url => { if (url) openAuthLink(url); });
    const subscription = Linking.addEventListener('url', event => openAuthLink(event.url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const openRevamp = () => setScreen(isPremium ? 'revamp-menu' : 'revamp-paywall');

  // ── Adding a scanned / manually-entered item to the library ────────────────
  // (Replaces the old Results screen.) Runs the background cutout, saves the
  // item, then returns to the picker so the user can scan the next thing.
  const attemptCutout = async (photo) => {
    try {
      // Hits the Supabase Edge Function (functions/remove-bg), which holds the
      // remove.bg key server-side. invoke() attaches the signed-in user's JWT.
      const { data, error } = await supabase.functions.invoke('remove-bg', {
        body: { photo },
      });
      if (!error && data?.image) return data.image;
    } catch {
      // fall through to the retry / skip prompt below
    }
    return null;
  };

  const finishAddItem = async (product, image, isCutout) => {
    try {
      await addSetupItem(activeSetup?.id || 'default', product, image, isCutout);
      // During the tutorial the celebration flies the cutout into the Profile
      // tab, so land on Home where the bottom nav is visible behind it.
      setScreen(isTutorialActive() ? 'home' : 'picker');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const addScannedItem = async (product) => {
    advanceTutorial('receipt-save'); // saving the receipt completes tutorial step 4
    setSaving(true);
    const cutImage = await attemptCutout(photoBase64);
    if (cutImage) {
      // Hold the user's first cutout so the tutorial can celebrate it —
      // "background gone ✨", then drop it into a board slot.
      if (isTutorialActive()) setTutorialCutout(cutImage);
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
        {
          text: 'Save without cutout',
          onPress: () => {
            // No cutout to celebrate — skip the reveal/board moments and land
            // on the finale so the tutorial still closes out warmly.
            jumpTutorial('all-set');
            setSaving(true);
            finishAddItem(product, photoBase64, false);
          },
        },
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

  // Last step of onboarding — build the first board, then drop the user into the
  // feed rather than the setup screen, so they land on the app's main surface.
  const startFirstBuild = async () => {
    const setup = await createSetup('My Setup', 'pc');
    setActiveSetup(setup);
    setAfterBoardBuilder('home');
    setScreen('board-builder');
  };

  const designFromScratch = async (type = 'pc') => {
    setRevampBasePhoto(null);
    setRevampAutoGenerate(false);
    const setup = await createSetup('My Setup', type);
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
          onSkip={() => setScreen('home')}
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
          onBack={() => setScreen('home')}
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
    if (screen === 'search') {
      return <SearchScreen onClose={() => setScreen('home')} />;
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
            } else if (afterBoardBuilder === 'home') {
              // Backing out of the onboarding build still lands on the feed —
              // onboarding is over either way, so don't strand them in Profile.
              setScreen('home');
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
          onExistingSetup={() => setScreen('revamp-setup-picker')}
        />
      );
    }
    if (screen === 'revamp-setup-picker') {
      return (
        <RevampSetupPickerScreen
          onBack={() => setScreen('revamp-menu')}
          onSelect={(setup) => {
            setActiveSetup(setup);
            setRevampBasePhoto(null);
            setRevampAutoGenerate(false);
            setScreen('revamp');
          }}
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
        onSearch={() => setScreen('search')}
      />
    );
  }

  if (!ready || saving) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <StatusBar hidden />
          <LoadingScreen style={styles.loadingMedia} />
        </View>
      </SafeAreaProvider>
    );
  }

  // Tutorial cutout-reveal beat — a modal that flies the cutout into the
  // Profile tab over whatever screen the flow landed on.
  const showCutoutReveal = tutorialStepId === 'cutout-reveal' && tutorialCutout;

  const closeCelebration = (end) => {
    end();
    setTutorialCutout(null);
  };

  return (
    <SafeAreaProvider>
      {/* The finale is a whole page of its own — it replaces the board rather
          than layering over it. */}
      {tutorialStepId === 'all-set'
        ? <TutorialEndScreen onDone={() => closeCelebration(completeTutorial)} />
        : renderScreen()}
      {showCutoutReveal && (
        <TutorialCelebration
          stepId={tutorialStepId}
          cutoutUri={imageUri(tutorialCutout, 'image/png')}
          onAdvance={advanceTutorial}
          onDone={() => closeCelebration(completeTutorial)}
          onSkip={() => closeCelebration(skipTutorial)}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  loadingMedia: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
