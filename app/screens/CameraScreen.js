import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export default function CameraScreen({ onPhotoTaken, onBack }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);

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

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.4, base64: true });
      onPhotoTaken(photo.uri, photo.base64);
    } catch (e) {
      Alert.alert('Error', 'Could not capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      onPhotoTaken(result.assets[0].uri, result.assets[0].base64);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.topButton}>
            <Text style={styles.topButtonText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}
            style={styles.topButton}
          >
            <Text style={styles.topButtonText}>⟳</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
            <Text style={styles.galleryIcon}>🖼</Text>
            <Text style={styles.galleryLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterButton, capturing && styles.shutterDisabled]}
            onPress={takePhoto}
            disabled={capturing}
          >
            {capturing
              ? <ActivityIndicator color="#0F0F0F" />
              : <View style={styles.shutterInner} />}
          </TouchableOpacity>

          <View style={styles.galleryButton} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  shutterDisabled: { opacity: 0.5 },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 20,
  },
  permissionText: { color: '#aaa', fontSize: 16, textAlign: 'center' },
  permButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permButtonText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
  backLink: { color: '#555', fontSize: 14 },
});
