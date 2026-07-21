import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  fetchItemPrice,
  getAllItems,
  getPosts,
  getSetups,
  removeSetupItem,
  setItemPublic,
} from '../config/setup';
import BoardPreview from '../components/BoardPreview';
import { imageUri } from '../config/media';

const C = {
  bg: '#FFFFFF', panel: '#F5F5F7', border: '#ECECEE',
  ink: '#0E0E10', sub: '#8A8A92', sub2: '#4A4A52', link: '#3D6BB3',
};

const SPEC_LABELS = {
  percentage: 'Size',
  switches: 'Switches',
  layout: 'Layout',
  connection: 'Connection',
  weight: 'Weight',
  dpi: 'DPI',
  polling: 'Polling rate',
  sensor: 'Sensor',
  hz: 'Refresh',
  inches: 'Size',
  resolution: 'Resolution',
  features: 'Panel / Features',
  size: 'Size',
  material: 'Surface',
  thickness: 'Thickness',
  color: 'Color',
  cpu: 'CPU',
  gpu: 'GPU',
  motherboard: 'Motherboard',
  psu: 'Power supply',
  case: 'Case',
  rgb: 'RGB',
  form_factor: 'Form factor',
  role: 'Role',
  ram: 'RAM',
  storage: 'Storage',
  os: 'OS / Platform',
  notes: 'Notes',
};
const SPEC_FIELD_ORDER = {
  mouse_specs: ['weight', 'connection', 'dpi', 'switches', 'polling', 'sensor'],
  keyboard_specs: ['percentage', 'switches', 'layout', 'connection'],
  monitor_specs: ['hz', 'inches', 'resolution', 'features'],
  deskmat_specs: ['size', 'material', 'thickness', 'color'],
  pc_specs: ['case', 'cpu', 'gpu', 'motherboard', 'psu', 'rgb'],
  server_specs: ['form_factor', 'role', 'cpu', 'ram', 'storage', 'os'],
  laptop_specs: [],
  console_specs: [],
  other_specs: ['model', 'color', 'notes'],
};

function BookmarkIcon({ filled = true }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={filled ? C.ink : 'none'} stroke={C.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function MoreIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={C.sub2}>
      <Circle cx="5" cy="12" r="2" />
      <Circle cx="12" cy="12" r="2" />
      <Circle cx="19" cy="12" r="2" />
    </Svg>
  );
}

function cleanCategory(value = 'gear') {
  return value.replace(/_/g, ' ').trim() || 'gear';
}

function titleCase(value = '') {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatSpecValue(value) {
  if (Array.isArray(value)) return value.map(formatSpecValue).filter(Boolean).join(' · ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object') {
    const unit = value.unit ? ` ${value.unit}` : '';
    const dimensions = ['width', 'height', 'depth']
      .map(key => value[key])
      .filter(part => part !== '' && part != null);
    if (dimensions.length > 0) return `${dimensions.join(' × ')}${unit}`;
    return Object.entries(value)
      .filter(([key, part]) => key !== 'unit' && part !== '' && part != null)
      .map(([key, part]) => `${titleCase(key)}: ${formatSpecValue(part)}`)
      .join(' · ');
  }
  return String(value ?? '').trim();
}

function productSpecs(product = {}) {
  const rows = [];
  const seen = new Set();
  const groups = Object.entries(product)
    .filter(([key, value]) => key.endsWith('_specs') && value && typeof value === 'object');

  for (const [groupKey, values] of groups) {
    // These orders mirror the fields shown on the category receipt. Unknown
    // future spec groups still render their saved values in object order.
    const fieldOrder = SPEC_FIELD_ORDER[groupKey] ?? Object.keys(values).filter(key => key !== 'brand' && key !== 'model');
    for (const key of fieldOrder) {
      const rawValue = values[key];
      const value = formatSpecValue(rawValue);
      if (!value || seen.has(key)) continue;
      seen.add(key);
      rows.push({ key, label: SPEC_LABELS[key] || titleCase(key), value });
    }
  }
  return rows;
}

function setupUsesItem(setup, itemId) {
  return Object.values(setup?.slots || {}).includes(itemId)
    || (setup?.dots || []).some(dot => dot.libraryItemId === itemId);
}

function SectionHeader({ title, action }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && <Text style={styles.sectionAction}>{action}</Text>}
    </View>
  );
}

function ProductCommentsView({ item, onBack }) {
  const comments = Array.isArray(item?.comments) ? item.comments : [];
  const productName = item?.product?.product_name || 'Product';

  return (
    <View style={styles.commentsContainer}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.commentsSafe} edges={['top', 'bottom']}>
        <View style={styles.commentsHeader}>
          <TouchableOpacity style={styles.circleButton} onPress={onBack} activeOpacity={0.75}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.commentsHeaderCopy}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <Text style={styles.commentsSubtitle} numberOfLines={1}>{productName}</Text>
          </View>
          <View style={styles.commentsHeaderSpacer} />
        </View>

        {comments.length > 0 ? (
          <ScrollView contentContainerStyle={styles.commentsList} showsVerticalScrollIndicator={false}>
            {comments.map((comment, index) => {
              const username = comment.handle || comment.username || '@user';
              const initials = comment.initials || username.replace('@', '').slice(0, 2).toUpperCase() || 'U';
              const body = comment.body || comment.text || '';
              return (
                <View key={comment.id || index} style={styles.commentCard}>
                  <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{initials}</Text></View>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentUser}>{username}</Text>
                    <Text style={styles.commentText}>{body}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.commentsEmpty}>
            <View style={styles.commentsEmptyIcon}><Text style={styles.commentsEmptyIconText}>···</Text></View>
            <Text style={styles.commentsEmptyTitle}>No comments yet</Text>
            <Text style={styles.commentsEmptyText}>Community comments and ownership advice for this item will appear here.</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

export default function ProductDetailScreen({ item: initialItem, onBack, onOpenSetup, onItemRemoved }) {
  const [item, setItem] = useState(initialItem);
  const [items, setItems] = useState([]);
  const [setups, setSetups] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isPublic = !!item?.isPublic;
  const togglePublic = async (next) => {
    if (!item) return;
    setSavingPublic(true);
    try {
      const updated = await setItemPublic(item.id, next);
      if (updated) setItem(updated);
    } catch (e) {
      Alert.alert('Couldn’t update visibility', e.message);
    } finally {
      setSavingPublic(false);
    }
  };

  const refreshPrice = async () => {
    if (!item) return;
    setPricing(true);
    try {
      const { item: updated, matched } = await fetchItemPrice(item);
      if (updated) setItem(updated);
      if (!matched) Alert.alert('No price found', 'Couldn’t find this product at Best Buy. Try editing the name or brand.');
    } catch (e) {
      Alert.alert('Price lookup failed', e.message);
    } finally {
      setPricing(false);
    }
  };

  useEffect(() => setItem(initialItem), [initialItem]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedItems, storedSetups, storedPosts] = await Promise.all([
          getAllItems(), getSetups(), getPosts(),
        ]);
        if (active) {
          setItems(storedItems);
          setSetups(storedSetups);
          setPosts(storedPosts);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const product = item?.product || {};
  const category = cleanCategory(product.category);
  const specs = useMemo(() => productSpecs(product), [product]);
  const usedIn = useMemo(() => {
    const publicSetupIds = new Set(posts.map(post => post.setupId).filter(Boolean));
    return setups.filter(setup => publicSetupIds.has(setup.id) && setupUsesItem(setup, item?.id));
  }, [item?.id, posts, setups]);
  const similar = useMemo(
    () => items.filter(candidate => candidate.id !== item?.id
      && cleanCategory(candidate.product?.category).toLowerCase() === category.toLowerCase()).slice(0, 8),
    [category, item?.id, items],
  );
  const purchaseUrl = product.purchase_url || product.product_url || product.source_url || null;
  const isInLibrary = items.some(candidate => candidate.id === item?.id);

  const removeFromLibrary = () => {
    if (!item || removing) return;
    const name = product.product_name || 'this item';
    Alert.alert(
      'Remove item from library?',
      `Remove "${name}" from your gear library? It will also be removed from any board it is on.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeSetupItem(null, item.id);
              setItems(current => current.filter(candidate => candidate.id !== item.id));
              setRemoving(false);
              onItemRemoved?.(item.id);
            } catch (e) {
              setRemoving(false);
              Alert.alert('Couldn’t remove item', e.message);
            }
          },
        },
      ],
    );
  };

  const postForSetup = setup => {
    const storedPost = posts.find(post => post.setupId === setup.id);
    return {
      id: storedPost?.id || `setup-${setup.id}`,
      username: storedPost?.username || 'you',
      handle: storedPost?.handle || '@you',
      initials: storedPost?.initials || 'ME',
      title: storedPost?.title || setup.name || 'My setup',
      caption: storedPost?.caption || '',
      description: storedPost?.description || '',
      tags: storedPost?.tags || [],
      likes: storedPost?.likes || 0,
      comments: storedPost?.comments || 0,
      photo: setup.photo || null,
      extraPhotos: setup.extraPhotos || [],
      dots: setup.dots || [],
      boardSetup: setup,
      boardItems: items,
    };
  };
  const openSetup = setup => {
    if (!onOpenSetup) return;
    onOpenSetup({ setup, post: postForSetup(setup) });
  };

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <View style={styles.center}><Text style={styles.emptyTitle}>Product unavailable</Text></View>
      </SafeAreaView>
    );
  }

  if (commentsOpen) {
    return <ProductCommentsView item={item} onBack={() => setCommentsOpen(false)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity style={styles.circleButton} onPress={onBack} activeOpacity={0.75}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topbarTitle} numberOfLines={1}>{product.product_name || 'Product'}</Text>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => Alert.alert('Saved', 'This item is already in your gear library.')}
            activeOpacity={0.75}
          >
            <BookmarkIcon />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => Alert.alert('Product options', 'More product actions will appear here as they become available.')}
            activeOpacity={0.75}
          >
            <MoreIcon />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>{category.toUpperCase()}</Text>
            <View style={styles.heroImageBox}>
              {item.photoBase64 ? (
                <Image source={{ uri: imageUri(item.photoBase64, 'image/png') }} style={styles.heroImage} contentFit="contain" />
              ) : (
                <Text style={styles.noPhoto}>No product photo</Text>
              )}
            </View>
            {product.brand && product.brand !== 'Unknown' ? (
              <Text style={styles.brand}>{product.brand.toUpperCase()}</Text>
            ) : null}
            <Text style={styles.productName}>{product.product_name || 'Unnamed gear'}</Text>

            {/* Price */}
            <View style={styles.priceRow}>
              {product.price != null ? (
                <View style={styles.priceInfo}>
                  <Text style={styles.priceValue}>${Number(product.price).toLocaleString()}</Text>
                  {product.regular_price != null && product.regular_price > product.price && (
                    <Text style={styles.priceWas}>${Number(product.regular_price).toLocaleString()}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.priceNone}>No price yet</Text>
              )}
              <TouchableOpacity style={styles.priceBtn} onPress={refreshPrice} disabled={pricing} activeOpacity={0.85}>
                {pricing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.priceBtnText}>{product.price != null ? 'Refresh price' : 'Get price'}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Public toggle */}
            <View style={styles.publicRow}>
              <View style={styles.publicInfo}>
                <Text style={styles.publicLabel}>{isPublic ? 'Public' : 'Private'}</Text>
                <Text style={styles.publicHint}>
                  {isPublic ? 'Visible on your profile and in search' : 'Only you can see this item'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={togglePublic}
                disabled={savingPublic}
                trackColor={{ false: '#D8D8DC', true: C.ink }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.usagePill}>
              <View style={styles.usageDots}>
                {[0, 1, 2].slice(0, Math.max(1, Math.min(3, usedIn.length))).map(index => (
                  <View key={index} style={[styles.usageDot, index === 1 && styles.usageDotTwo, index === 2 && styles.usageDotThree]} />
                ))}
              </View>
              <Text style={styles.usageText}>
                {usedIn.length === 0 ? 'Not on a public board yet' : `Used in ${usedIn.length} public ${usedIn.length === 1 ? 'setup' : 'setups'}`}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {isInLibrary && (
              <TouchableOpacity
                style={[styles.libraryButton, removing && styles.libraryButtonDisabled]}
                onPress={removeFromLibrary}
                disabled={removing}
                activeOpacity={0.8}
              >
                {removing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.libraryButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>Remove item from library</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.commentsButton} onPress={() => setCommentsOpen(true)} activeOpacity={0.8}>
              <Text style={styles.commentsButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>View comments</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Specs" />
            {specs.length > 0 ? (
              <View style={styles.specCard}>
                {specs.map((spec, index) => (
                  <View key={spec.key} style={[styles.specRow, index === specs.length - 1 && styles.specRowLast]}>
                    <Text style={styles.specKey}>{spec.label}</Text>
                    <Text style={styles.specValue}>{spec.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No specifications were entered when this item was added.</Text>
              </View>
            )}
          </View>

          {!!purchaseUrl && (
            <View style={styles.section}>
              <SectionHeader title="Where to get it" />
              <TouchableOpacity style={styles.buyCard} onPress={() => Linking.openURL(purchaseUrl)} activeOpacity={0.8}>
                <View style={styles.buyIcon}><Text style={styles.buyIconText}>↗</Text></View>
                <View style={styles.buyInfo}>
                  <Text style={styles.buyTitle}>Open product source</Text>
                  <Text style={styles.buySubtitle} numberOfLines={1}>{purchaseUrl}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader
              title={usedIn.length > 0 ? `Used in ${usedIn.length} public ${usedIn.length === 1 ? 'setup' : 'setups'}` : 'Public setup usage'}
            />
            {loading ? (
              <ActivityIndicator color={C.ink} style={styles.loader} />
            ) : usedIn.length > 0 ? (
              <View style={styles.setupGrid}>
                {usedIn.map(setup => (
                  <TouchableOpacity
                    key={setup.id}
                    style={styles.setupTile}
                    onPress={() => openSetup(setup)}
                    disabled={!onOpenSetup}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.setupVisual, setup.photo ? styles.setupPhotoVisual : styles.setupBoardVisual]}>
                      {setup.photo ? (
                        <Image source={{ uri: imageUri(setup.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <BoardPreview setup={setup} items={items} style={styles.setupBoardPreview} />
                      )}
                    </View>
                    <Text style={styles.setupName} numberOfLines={1}>{postForSetup(setup).handle || setup.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Only published boards containing this item appear here.</Text>
              </View>
            )}
          </View>

          {similar.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={`Similar ${category}`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map(candidate => (
                  <TouchableOpacity key={candidate.id} style={styles.similarCard} onPress={() => setItem(candidate)} activeOpacity={0.85}>
                    <View style={styles.similarImageBox}>
                      {candidate.photoBase64 ? (
                        <Image source={{ uri: imageUri(candidate.photoBase64, 'image/png') }} style={styles.similarImage} contentFit="contain" />
                      ) : (
                        <Text style={styles.noPhotoSmall}>No photo</Text>
                      )}
                    </View>
                    <Text style={styles.similarName} numberOfLines={1}>{candidate.product?.product_name || 'Unnamed gear'}</Text>
                    <Text style={styles.similarMeta} numberOfLines={1}>{candidate.product?.brand || category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.bg },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg,
  },
  circleButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.panel,
    borderWidth: 1, borderColor: '#DCDCE0', alignItems: 'center', justifyContent: 'center',
  },
  backButton: { margin: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.sub2, fontSize: 27, lineHeight: 29, marginTop: -2 },
  topbarTitle: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '600' },
  content: { backgroundColor: C.bg },
  hero: {
    alignItems: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 22,
    backgroundColor: '#F9F9FA', borderBottomWidth: 1, borderBottomColor: C.border,
  },
  eyebrow: { color: C.sub, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },
  heroImageBox: { width: 240, maxWidth: '78%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroImage: { width: '90%', height: '90%' },
  noPhoto: { color: C.sub, fontSize: 12 },
  brand: { color: '#6A6A72', fontSize: 12, letterSpacing: 1.5, fontWeight: '600', marginBottom: 5 },
  productName: { color: C.ink, fontFamily: 'Georgia', fontSize: 24, lineHeight: 30, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 },
  priceInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  priceValue: { color: C.ink, fontSize: 22, fontWeight: '800' },
  priceWas: { color: C.sub, fontSize: 14, fontWeight: '500', textDecorationLine: 'line-through' },
  priceNone: { color: C.sub, fontSize: 14, fontWeight: '500' },
  priceBtn: { backgroundColor: C.ink, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 18, minWidth: 96, alignItems: 'center' },
  priceBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  publicRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    alignSelf: 'stretch', backgroundColor: C.panel, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14,
  },
  publicInfo: { flex: 1, minWidth: 0 },
  publicLabel: { color: C.ink, fontSize: 15, fontWeight: '700' },
  publicHint: { color: C.sub, fontSize: 12, marginTop: 2 },
  usagePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  usageDots: { flexDirection: 'row', paddingLeft: 4 },
  usageDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#557CAA', borderWidth: 2, borderColor: C.ink, marginLeft: -4 },
  usageDotTwo: { backgroundColor: '#A46D57' },
  usageDotThree: { backgroundColor: '#57906C' },
  usageText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  actionRow: { gap: 8, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  libraryButton: { width: '100%', overflow: 'hidden', backgroundColor: C.ink, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 10, alignItems: 'center' },
  libraryButtonDisabled: { opacity: 0.65 },
  libraryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  commentsButton: { width: '100%', overflow: 'hidden', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 10, alignItems: 'center' },
  commentsButtonText: { color: C.ink, fontSize: 14, fontWeight: '600' },
  section: { paddingHorizontal: 18, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: C.sub, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', textTransform: 'uppercase' },
  sectionAction: { color: C.link, fontSize: 12, fontWeight: '600' },
  specCard: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 20, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  specRowLast: { borderBottomWidth: 0 },
  specKey: { color: '#6A6A72', fontSize: 11, letterSpacing: 1.1, fontWeight: '600', textTransform: 'uppercase' },
  specValue: { flex: 1, color: C.ink, fontSize: 13.5, fontWeight: '600', textAlign: 'right' },
  emptyCard: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  emptyText: { color: C.sub, fontSize: 13, lineHeight: 19 },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { paddingVertical: 24 },
  buyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  buyIcon: { width: 38, height: 38, borderRadius: 9, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  buyIconText: { color: C.sub2, fontSize: 17, fontWeight: '700' },
  buyInfo: { flex: 1 },
  buyTitle: { color: C.ink, fontSize: 13.5, fontWeight: '600' },
  buySubtitle: { color: '#6A6A72', fontSize: 12, marginTop: 2 },
  chevron: { color: C.sub, fontSize: 20 },
  setupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  setupTile: {
    width: '48.4%', borderRadius: 11, overflow: 'hidden', backgroundColor: C.panel,
    borderWidth: 1, borderColor: C.border,
  },
  setupVisual: { width: '100%', overflow: 'hidden', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  setupPhotoVisual: { aspectRatio: 4 / 3 },
  setupBoardVisual: { padding: 7 },
  setupBoardPreview: { borderRadius: 8 },
  setupName: { color: C.sub2, fontSize: 11, fontWeight: '600', paddingHorizontal: 9, paddingVertical: 8 },
  similarRow: { gap: 8, paddingBottom: 4 },
  similarCard: { width: 130, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  similarImageBox: { width: '100%', aspectRatio: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  similarImage: { width: '82%', height: '82%' },
  noPhotoSmall: { color: C.sub, fontSize: 10.5 },
  similarName: { color: C.ink, fontSize: 12, fontWeight: '600' },
  similarMeta: { color: C.sub, fontSize: 10.5, marginTop: 2 },
  bottomPad: { height: 36 },
  commentsContainer: { flex: 1, backgroundColor: C.bg },
  commentsSafe: { flex: 1, backgroundColor: C.bg },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  commentsHeaderCopy: { flex: 1, alignItems: 'center' },
  commentsHeaderSpacer: { width: 36, height: 36 },
  commentsTitle: { color: C.ink, fontSize: 17, fontWeight: '700' },
  commentsSubtitle: { color: C.sub, fontSize: 11.5, marginTop: 1, maxWidth: '90%' },
  commentsList: { padding: 18, gap: 10 },
  commentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#557CAA', alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  commentBody: { flex: 1, gap: 3 },
  commentUser: { color: C.ink, fontSize: 12.5, fontWeight: '700' },
  commentText: { color: C.sub2, fontSize: 13, lineHeight: 18 },
  commentsEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 50 },
  commentsEmptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  commentsEmptyIconText: { color: C.sub, fontSize: 18, fontWeight: '700', marginTop: -7 },
  commentsEmptyTitle: { color: C.ink, fontSize: 17, fontWeight: '700' },
  commentsEmptyText: { color: C.sub, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
});
