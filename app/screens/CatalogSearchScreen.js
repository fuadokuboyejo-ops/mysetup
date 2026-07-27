import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, StatusBar, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import { searchCatalog, addCatalogItem, cleanTitle, classifyQuery } from '../config/catalog';
import { PRODUCT_GUIDES } from './ProductPickerScreen';

const C = {
  bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0',
  text: '#161616', sub: '#8A8792', accent: '#161616', ok: '#2E7D57',
};

// "All" plus the same categories the picker uses, so a result lands in the
// right library section. `null` = no category scope.
const CATS = [['all', 'All'], ...Object.entries(PRODUCT_GUIDES).map(([k, v]) => [k, v.label])];

function formatPrice(price, currency) {
  if (price == null) return '';
  const n = Number(price).toFixed(2);
  return currency && currency !== 'USD' ? `${n} ${currency}` : `$${n}`;
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={1.9}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </Svg>
  );
}

function ResultRow({ item, category, onAdded }) {
  const [state, setState] = useState('idle'); // idle | adding | added

  const add = async () => {
    if (state !== 'idle') return;
    setState('adding');
    try {
      await addCatalogItem(item, category === 'all' ? 'other' : category);
      setState('added');
      onAdded?.();
    } catch (e) {
      setState('idle');
      Alert.alert('Couldn’t add', e.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.row}>
      <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" transition={120} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{cleanTitle(item.title)}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowPrice}>{formatPrice(item.price, item.currency)}</Text>
          {item.condition ? <Text style={styles.rowCond}>{item.condition}</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.addBtn, state === 'added' && styles.addBtnDone]}
        onPress={add}
        disabled={state !== 'idle'}
        activeOpacity={0.85}
      >
        {state === 'adding'
          ? <ActivityIndicator size="small" color="#FFFFFF" />
          : <Text style={styles.addBtnText}>{state === 'added' ? 'Added ✓' : 'Add'}</Text>}
      </TouchableOpacity>
    </View>
  );
}

export default function CatalogSearchScreen({ onBack, onAdded, initialCategory }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(
    initialCategory && PRODUCT_GUIDES[initialCategory] ? initialCategory : 'all',
  );
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);
  const [notTech, setNotTech] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const run = async (q = query, cat = category) => {
    const term = q.trim();
    if (!term) return;
    Keyboard.dismiss();
    setError(null);
    setNotTech(false);
    setSearched(true);

    // Gently reject clearly non-tech searches before hitting eBay.
    if (classifyQuery(term) === 'nontech') {
      setResults([]);
      setNotTech(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await searchCatalog(term, cat === 'all' ? undefined : cat);
      setResults(r);
    } catch (e) {
      setError(e.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} translucent={false} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add from catalog</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <SearchIcon />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => run()}
            placeholder="Search products (e.g. Keychron K2)"
            placeholderTextColor={C.sub}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        <FlatList
          data={CATS}
          keyExtractor={([k]) => k}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
          renderItem={({ item: [key, label] }) => {
            const on = category === key;
            return (
              <TouchableOpacity
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => { setCategory(key); if (searched) run(query, key); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Results */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.accent} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.emptyHint}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => run()}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : notTech ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>That’s not tech gear</Text>
            <Text style={styles.emptyHint}>mysetup’s catalog is desk setup gear only — try a keyboard, mouse, monitor, PC, laptop, headset, or console.</Text>
          </View>
        ) : !searched ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Find your gear</Text>
            <Text style={styles.emptyHint}>Search for any product and add it straight to your setup.</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyHint}>Try a different name or a broader search.</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, i) => item.itemId || String(i)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <ResultRow item={item} category={category} onAdded={onAdded} />
            )}
            ListFooterComponent={
              <Text style={styles.disclaimer}>
                Prices &amp; availability from eBay, updated live. Adding saves it to your library.
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, fontWeight: '300', color: C.text, lineHeight: 32 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4, marginLeft: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 16, marginTop: 4, paddingHorizontal: 14, height: 46,
    backgroundColor: C.card, borderRadius: 13, borderWidth: 1, borderColor: C.border,
  },
  input: { flex: 1, fontSize: 15, color: C.text, padding: 0 },
  clear: { color: C.sub, fontSize: 15, paddingHorizontal: 2 },

  chipsScroll: { flexGrow: 0, marginTop: 12 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: C.sub },
  chipTextOn: { color: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyHint: { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 16, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  list: { padding: 16, paddingBottom: 40, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 10,
  },
  thumb: { width: 62, height: 62, borderRadius: 10, backgroundColor: '#F3F1EC' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  rowPrice: { fontSize: 15, fontWeight: '800', color: C.text },
  rowCond: { fontSize: 11, color: C.sub, backgroundColor: '#F3F1EC', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  addBtn: { minWidth: 66, height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnDone: { backgroundColor: C.ok },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  disclaimer: { color: C.sub, fontSize: 11.5, textAlign: 'center', marginTop: 18, paddingHorizontal: 20, lineHeight: 16 },
});
