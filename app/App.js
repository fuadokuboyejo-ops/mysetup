import { useState, useEffect } from 'react';
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
import { createSetup, getIsPremium } from './config/setup';
import HomeScreen from './screens/HomeScreen';
import ProductPickerScreen from './screens/ProductPickerScreen';
import CameraScreen from './screens/CameraScreen';
import BoardBuilderScreen from './screens/BoardBuilderScreen';
import PreviewScreen from './screens/PreviewScreen';
import ResultsScreen from './screens/ResultsScreen';
import SetupScreen from './screens/SetupScreen';
import ProfileScreen from './screens/ProfileScreen';
import RevampMenuScreen from './screens/RevampMenuScreen';
import RevampScreen from './screens/RevampScreen';
import RevampPaywallScreen from './screens/RevampPaywallScreen';

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [results, setResults] = useState(null);
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

  useEffect(() => { getIsPremium().then(setIsPremiumState); }, []);

  const openRevamp = () => setScreen(isPremium ? 'revamp-menu' : 'revamp-paywall');

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
            setScreen(afterBoardBuilder);
            setAfterBoardBuilder('setup');
          }}
          onCancel={() => setScreen('profile')}
        />
      );
    }
    if (screen === 'preview') {
      return (
        <PreviewScreen
          photoUri={photoUri}
          photoBase64={photoBase64}
          productType={productType}
          onResults={(product, uri) => { setResults(product); setPhotoUri(uri); setScreen('results'); }}
          onRetake={() => setScreen('camera')}
        />
      );
    }
    if (screen === 'results') {
      return (
        <ResultsScreen
          items={results}
          photoUri={photoUri}
          photoBase64={photoBase64}
          setupId={activeSetup?.id}
          onScanAgain={() => setScreen('picker')}
          onViewSetup={() => {
            setSetupInitialView('items');
            setScreen('setup');
          }}
        />
      );
    }
    if (screen === 'setup') {
      return (
        <SetupScreen
          setup={activeSetup}
          initialView={setupInitialView}
          autoArrange={afterSetup === 'revamp'}
          onBack={() => { setScreen(afterSetup); setAfterSetup('profile'); }}
          onScanMore={() => setScreen('picker')}
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
          onDifferentGear={(photo) => { setRevampBasePhoto(photo || null); setScreen('revamp'); }}
          onExistingSetup={() => setScreen('profile')}
        />
      );
    }
    if (screen === 'revamp') {
      return (
        <RevampScreen
          setup={activeSetup}
          basePhoto={revampBasePhoto}
          onBack={() => setScreen('revamp-menu')}
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

  return <SafeAreaProvider>{renderScreen()}</SafeAreaProvider>;
}
