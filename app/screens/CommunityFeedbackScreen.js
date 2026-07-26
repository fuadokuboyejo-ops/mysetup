import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFeedback, submitFeedback } from '../config/feedback';

// Short relative time, e.g. "just now", "3h", "2d".
function timeAgo(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function initialsOf(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}

export default function CommunityFeedbackScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getFeedback());
    } catch (e) {
      Alert.alert('Could not load feedback', e?.message || 'Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await submitFeedback(text);
      setDraft('');
      await load();
    } catch (e) {
      Alert.alert('Could not send', e?.message || 'Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={S.safe} edges={['top']}>
        <View style={S.header}>
          <TouchableOpacity onPress={onBack} style={S.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={S.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={S.title}>Community feedback</Text>
          <View style={S.back} />
        </View>

        <KeyboardAvoidingView
          style={S.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          {/* Compose */}
          <View style={S.compose}>
            <TextInput
              style={S.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Share feedback, ideas, or a bug…"
              placeholderTextColor="#A8A8AE"
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[S.sendBtn, (!draft.trim() || sending) && S.sendBtnDisabled]}
              onPress={send}
              disabled={!draft.trim() || sending}
              activeOpacity={0.85}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={S.sendBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={S.center}><ActivityIndicator color={C.accent} /></View>
          ) : items.length === 0 ? (
            <View style={S.center}>
              <Text style={S.emptyTitle}>No feedback yet</Text>
              <Text style={S.emptyHint}>Be the first to share something.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={S.list} showsVerticalScrollIndicator={false}>
              {items.map(item => (
                <View key={item.id} style={S.card}>
                  <View style={S.avatar}><Text style={S.avatarText}>{initialsOf(item.author)}</Text></View>
                  <View style={S.cardBody}>
                    <View style={S.cardTop}>
                      <Text style={S.author} numberOfLines={1}>{item.author}</Text>
                      <Text style={S.time}>{timeAgo(item.createdAt)}</Text>
                    </View>
                    <Text style={S.body}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const C = { bg: '#FFFFFF', ink: '#161616', sub: '#6E6E73', border: '#ECECEE', accent: '#3D6BB3' };

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.ink, fontSize: 30, fontWeight: '300', lineHeight: 32 },
  title: { color: C.ink, fontSize: 17, fontWeight: '700' },

  compose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: '#F4F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: C.ink, fontSize: 15,
  },
  sendBtn: { backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, minWidth: 64, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: C.sub, fontSize: 14 },

  list: { padding: 14, gap: 12 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#FAFAFB', borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1E2A44', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  author: { color: C.ink, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  time: { color: C.sub, fontSize: 12 },
  body: { color: '#2B2B31', fontSize: 14, lineHeight: 20 },
});
