import { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import PreviewScreen from './screens/PreviewScreen';
import ResultsScreen from './screens/ResultsScreen';
import SetupScreen from './screens/SetupScreen';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [results, setResults] = useState(null);

  const handlePhotoTaken = (uri, base64) => {
    setPhotoUri(uri);
    setPhotoBase64(base64);
    setScreen('preview');
  };

  const handleResults = (product, uri) => {
    setResults(product);
    setPhotoUri(uri);
    setScreen('results');
  };

  if (screen === 'camera') {
    return (
      <CameraScreen
        onPhotoTaken={handlePhotoTaken}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'preview') {
    return (
      <PreviewScreen
        photoUri={photoUri}
        photoBase64={photoBase64}
        onResults={handleResults}
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
        onScanAgain={() => setScreen('home')}
        onViewSetup={() => setScreen('setup')}
      />
    );
  }

  if (screen === 'setup') {
    return (
      <SetupScreen onBack={() => setScreen('home')} />
    );
  }

  return (
    <HomeScreen
      onStartScan={() => setScreen('camera')}
      onViewSetup={() => setScreen('setup')}
    />
  );
}
