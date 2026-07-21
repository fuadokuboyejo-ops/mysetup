import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { updateSetupWallpaper, addSetupItem } from '../config/setup';
import { supabase } from '../config/supabase';

const MONITOR_PRODUCT = {
  category: 'monitor',
  product_name: 'Monitor',
  brand: 'Unknown',
  confidence: 1,
  primary_colors: [],
  materials: [],
  surface_texture: '',
  estimated_dimensions: {},
};

export default function LivePhotoPreviewScreen({ videoUri, photoBase64, cropMeta, setupId, onSave, onRetake }) {
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState('');

  const player = useVideoPlayer(videoUri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.play();
  }, [player]);

  const handleSave = async () => {
    if (!photoBase64) {
      Alert.alert('Missing photo', 'No still photo was captured. Please retake.');
      return;
    }
    if (!videoUri) {
      Alert.alert('Missing video', 'No video was recorded. Please retake.');
      return;
    }

    setSaving(true);
    try {
      // 1. Background removal on the still photo — best-effort only. A monitor/desk
      // shot usually has no isolated foreground, so remove.bg will fail; that must
      // NOT abort the save, since the live wallpaper (below) is the important part.
      setStatusText('Removing background…');
      let itemImage = photoBase64;
      try {
        const { data, error } = await supabase.functions.invoke('remove-bg', {
          body: { photo: photoBase64 },
        });
        if (!error && data?.image) itemImage = data.image;
      } catch {
        // keep the raw still
      }

      // 2. Add monitor item with the still (bg-removed if it worked, else raw)
      setStatusText('Adding to setup…');
      await addSetupItem(setupId || 'default', MONITOR_PRODUCT, itemImage);

      // 3. Persist the video in Supabase Storage. Live-video background
      // processing is intentionally not routed through a second backend.
      setStatusText('Saving live wallpaper…');
      await updateSetupWallpaper(setupId || 'default', videoUri);

      onSave();
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Could not save. Please try again.');
      setSaving(false);
      setStatusText('');
    }
  };

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      <View style={styles.topOverlay} />
      <View style={styles.bottomOverlay} />

      <SafeAreaView style={styles.ui}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onRetake} style={styles.topButton} disabled={saving}>
            <Text style={styles.topButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>● LIVE</Text>
          </View>
          <View style={styles.topButton} />
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomBar}>
          <Text style={styles.hint}>
            Your monitor will appear on the board{'\n'}with this video playing as its wallpaper
          </Text>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <View style={styles.row}>
                <ActivityIndicator color="#0c0c0e" size="small" />
                <Text style={styles.saveButtonText}>{statusText}</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>Save to My Setup</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.retakeButton}
            onPress={onRetake}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeButtonText}>Retake</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 280,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  ui: { flex: 1, justifyContent: 'space-between' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  topButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  liveBadge: {
    backgroundColor: 'rgba(255,59,48,0.75)',
    borderRadius: 12,
    paddingVertical: 5, paddingHorizontal: 14,
  },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  saveButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 54,
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#0c0c0e', fontSize: 16, fontWeight: '700' },

  retakeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  retakeButtonText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
