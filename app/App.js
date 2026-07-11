import { useState } from 'react';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import ProductPickerScreen from './screens/ProductPickerScreen';
import CameraScreen from './screens/CameraScreen';
import BoardBuilderScreen from './screens/BoardBuilderScreen';
import PreviewScreen from './screens/PreviewScreen';
import ResultsScreen from './screens/ResultsScreen';
import SetupScreen from './screens/SetupScreen';
import ProfileScreen from './screens/ProfileScreen';
import RevampScreen from './screens/RevampScreen';

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [results, setResults] = useState(null);
  const [productType, setProductType] = useState(null);
  const [productGuide, setProductGuide] = useState(null);
  const [activeSetup, setActiveSetup] = useState(null);
  const [setupInitialView, setSetupInitialView] = useState('board');

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

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        onContinue={() => setScreen('home')}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'picker') {
    return (
      <ProductPickerScreen
        onSelect={(type, guide) => goToCamera(type, guide)}
        onBack={() => setScreen(activeSetup ? 'setup' : 'home')}
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
        onDone={(setup) => { setActiveSetup(setup); setScreen('setup'); }}
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
        onBack={() => setScreen('profile')}
        onScanMore={() => setScreen('picker')}
        onDelete={() => {
          setActiveSetup(null);
          setScreen('profile');
        }}
      />
    );
  }

  if (screen === 'revamp') {
    return <RevampScreen onBack={() => setScreen('home')} />;
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
      onRevamp={() => setScreen('revamp')}
    />
  );
}
