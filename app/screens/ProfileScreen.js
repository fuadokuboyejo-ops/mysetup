import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Alert, TextInput, Modal, ActivityIndicator, StatusBar, Share, Dimensions,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSetups, createSetup, deleteSetup, getAllItems, getPosts, deletePostsBySetup, syncPublicItemsFromPosts, SETUP_TYPES, BUILDABLE_TYPES } from '../config/setup';
import { computeLayout, normalizeNodes, nodeSpan } from '../config/boardLayout';
import { supabase } from '../config/supabase';
import { getProfileMedia, saveProfileImage } from '../config/profile';
import { imageUri } from '../config/media';
import StitchBorder from '../components/StitchBorder';
import ProductDetailScreen from './ProductDetailScreen';
import TutorialOverlay, { useTutorialTarget } from '../components/TutorialOverlay';
import { TUTORIAL_STEPS, useTutorialStep, advanceTutorial, jumpTutorial, skipTutorial } from '../config/tutorial';

// Shown on the profile — swap for the signed-in user's handle once auth lands.
const USERNAME = 'fuad';

const TABS = ['Items', 'Setups'];

// Exactly 3 piece columns: screen width minus side padding (16 each) and the two
// 10px gaps between the three cards. Pixel width avoids the "%+gap wraps" bug.
const PIECE_GAP = 10;
const PIECE_PAD = 16;
const PIECE_COL = Math.floor((Dimensions.get('window').width - PIECE_PAD * 2 - PIECE_GAP * 2) / 3);

function itemPrice(item) {
  const rawPrice = item?.product?.price;
  const price = typeof rawPrice === 'string'
    ? Number(rawPrice.replace(/[^0-9.-]/g, ''))
    : Number(rawPrice);
  return Number.isFinite(price) ? price : 0;
}

function formatPrice(value) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Renders a setup's saved custom board — identical grid geometry to the builder
// and the setup Board tab (shared computeLayout), filled with THIS setup's own
// placements (nodeId → itemId) resolved against the shared item library.
function BoardPreview({ setup, items }) {
  const [w, setW] = useState(0);
  const nodes = normalizeNodes(setup?.boardLayout, setup?.type);
  const placements = setup?.slots || {};
  const filled = {};
  for (const [nodeId, itemId] of Object.entries(placements)) {
    const it = items?.find(i => i.id === itemId);
    if (it) filled[nodeId] = it;
  }
  const placedItemIds = new Set([
    ...Object.values(placements),
    ...(setup?.dots || []).map(dot => dot.libraryItemId),
  ].filter(Boolean));
  const setupValue = [...placedItemIds].reduce((sum, itemId) => {
    const item = items?.find(candidate => candidate.id === itemId);
    return sum + itemPrice(item);
  }, 0);
  const layout = computeLayout(nodes, w);

  return (
    <View
      style={[S.previewBoard, { height: layout.height }]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && nodes.map(node => {
        const r = layout.rects[node.id];
        if (!r) return null;
        const photo = filled[node.id]?.photoBase64;
        const span = nodeSpan(node);
        const vertical = span.rh > span.cw;
        const label = node.label?.trim() || 'slot';
        return (
          <View
            key={node.id}
            style={[
              S.previewSlot,
              { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h },
              photo && S.previewSlotFilled,
            ]}
          >
            {photo ? (
              <Image
                source={{ uri: imageUri(photo, 'image/png') }}
                style={S.previewSlotImage}
                resizeMode="contain"
              />
            ) : (
              <>
                <StitchBorder
                  width={r.w} height={r.h} radius={14}
                  color="#C7C7CC" strokeWidth={1.3} dash={5} gap={5}
                />
                <View style={S.previewSlotContent} pointerEvents="none">
                  {!vertical && <Text style={S.previewPlus}>+</Text>}
                  <Text style={[S.previewLabel, vertical && S.previewLabelRotated]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              </>
            )}
          </View>
        );
      })}
      {w > 0 && (
        <View style={S.previewPriceBadge} pointerEvents="none">
          <Text style={S.previewPriceText}>{formatPrice(setupValue)} total</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen({ onOpenSetup, onBuildSetup, onBack, onSetupDeleted }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Items');
  const [openedItem, setOpenedItem] = useState(null);
  const [setups, setSetups] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [creating, setCreating] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [profileMedia, setProfileMedia] = useState({});
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [savingProfileImage, setSavingProfileImage] = useState(null);
  // Tutorial: after arriving from the Profile-tab step, spotlight the Setups
  // tab and wait for the user to open it.
  const setupsStep = useTutorialStep('setups-tab');
  const setupsTarget = useTutorialTarget(setupsStep.active);
  // Then spotlight the setup they built during onboarding; tapping it opens
  // the board. If they have no setups (skipped the onboarding build), skip
  // straight to the finale rather than stalling on a target that isn't there.
  const openSetupStep = useTutorialStep('open-setup');
  const openSetupTarget = useTutorialTarget(openSetupStep.active && !loading && setups.length > 0);

  useEffect(() => {
    if (openSetupStep.active && !loading && setups.length === 0) jumpTutorial('all-set');
  }, [openSetupStep.active, loading, setups.length]);
  // setupIds that currently have a post on the feed — used to warn on delete.
  const [postedIds, setPostedIds] = useState(new Set());

  const load = useCallback(async () => {
    // Publish any gear sitting on an already-posted board first, so the Items
    // tab reflects the true public/private state (badges included).
    const items = await syncPublicItemsFromPosts();
    const [data, posts] = await Promise.all([getSetups(), getPosts()]);
    setSetups(data);
    setAllItems(items);
    setPostedIds(new Set(posts.map(p => p.setupId)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthUser(data.session?.user || null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthUser(session?.user || null);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    getProfileMedia(authUser).then(media => {
      if (active) setProfileMedia(media);
    });
    return () => { active = false; };
  }, [authUser]);

  const openModal = () => { setNewName(''); setNewType(''); setModalStep(1); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setNewName(''); setNewType(''); setModalStep(1); };

  const handleNext = () => {
    if (!newName.trim()) return;
    setModalStep(2);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newType) return;
    setCreating(true);
    const setup = await createSetup(newName.trim(), newType);
    closeModal();
    setCreating(false);
    await load();
    // These types start in the board builder so users can edit the layout first.
    if (BUILDABLE_TYPES.includes(newType) && onBuildSetup) onBuildSetup(setup);
    else onOpenSetup(setup);
  };

  const handleDelete = (setup) => {
    const isPosted = postedIds.has(setup.id);
    const message = isPosted
      ? `Delete "${setup.name}"? It's posted to the feed — deleting it will also remove that post. Your items stay in your library.`
      : `Delete "${setup.name}"? This removes the board and photo — your items stay in your library.`;
    Alert.alert('Delete Setup', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isPosted ? 'Delete & remove post' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSetup(setup.id);
          await deletePostsBySetup(setup.id);
          onSetupDeleted?.(setup.id);
          load();
        },
      },
    ]);
  };

  const totalItems = allItems.length;
  const totalItemValue = allItems.reduce((sum, item) => sum + itemPrice(item), 0);
  const formattedItemValue = formatPrice(totalItemValue);
  // Keep the old setup-photo backdrop as a fallback until the user chooses a
  // dedicated banner. A selected profile photo takes priority over OAuth art.
  const fallbackBannerPhoto = setups.find(s => s.photo)?.photo || null;
  const bannerUri = profileMedia.bannerBase64
    ? imageUri(profileMedia.bannerBase64)
    : profileMedia.bannerUrl || null;
  const avatarUrl = profileMedia.avatarBase64
    ? imageUri(profileMedia.avatarBase64)
    : profileMedia.avatarUrl
      || authUser?.user_metadata?.avatar_url
      || authUser?.user_metadata?.picture
      || null;
  const avatarInitial = (
    authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || authUser?.email
    || USERNAME
  ).trim().charAt(0).toUpperCase();
  const profileName = profileMedia.displayName || profileMedia.username || USERNAME;

  const handleShareProfile = () => {
    Share.share({ message: `Check out ${profileName}'s setups on mysetup.` }).catch(() => {});
  };
  const handleEditProfile = () => {
    setShowProfileEditor(true);
  };

  const handlePickProfileImage = async (kind) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile image.');
      return;
    }

    const isAvatar = kind === 'avatar';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: isAvatar,
      aspect: isAvatar ? [1, 1] : undefined,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSavingProfileImage(kind);
    try {
      const resized = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: isAvatar ? 512 : 1440 } }],
        { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const saved = await saveProfileImage(authUser, kind, resized.base64);
      setProfileMedia(saved);
    } catch (error) {
      Alert.alert(
        'Could not save profile image',
        error?.message || 'Please try again.',
      );
    } finally {
      setSavingProfileImage(null);
    }
  };

  return (
    <View style={S.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Banner hero */}
      <View style={S.banner}>
        {bannerUri || fallbackBannerPhoto ? (
          <Image
            source={{ uri: bannerUri || imageUri(fallbackBannerPhoto) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, S.bannerPlaceholder]} />
        )}
        <View style={[StyleSheet.absoluteFill, S.bannerScrim]} />

        {/* Back */}
        <View style={[S.bannerTop, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onBack} style={S.bannerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={S.bannerBackText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.bannerAvatarButton} onPress={handleEditProfile} activeOpacity={0.82}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={S.bannerAvatar} resizeMode="cover" />
            ) : (
              <View style={[S.bannerAvatar, S.bannerAvatarFallback]}>
                <Text style={S.bannerAvatarText}>{avatarInitial}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Identity */}
        <View style={S.bannerBody}>
          <Text style={S.bannerName}>{profileName}</Text>
          <View style={S.bannerStats}>
            <Text style={S.bannerStat}><Text style={S.bannerStatNum}>{totalItems}</Text> {totalItems === 1 ? 'item' : 'items'}</Text>
            <Text style={S.bannerDot}>·</Text>
            <Text style={S.bannerStat}><Text style={S.bannerStatNum}>{formattedItemValue}</Text> total</Text>
            <Text style={S.bannerDot}>·</Text>
            <Text style={S.bannerStat}><Text style={S.bannerStatNum}>{setups.length}</Text> {setups.length === 1 ? 'setup' : 'setups'}</Text>
          </View>
          <View style={S.bannerBtns}>
            <TouchableOpacity style={S.bannerBtn} onPress={handleEditProfile} activeOpacity={0.85}>
              <Text style={S.bannerBtnText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.bannerBtn} onPress={handleShareProfile} activeOpacity={0.85}>
              <Text style={S.bannerBtnText}>Share profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={S.tabBar}>
        {TABS.map(tab => {
          const active = activeTab === tab;
          const isSetupsTab = tab === 'Setups';
          return (
            <TouchableOpacity
              key={tab}
              ref={isSetupsTab ? setupsTarget.ref : undefined}
              onLayout={isSetupsTab ? setupsTarget.onLayout : undefined}
              style={S.tab}
              onPress={() => {
                if (isSetupsTab && setupsStep.active) advanceTutorial('setups-tab');
                setActiveTab(tab);
              }}
              activeOpacity={0.8}
            >
              <Text style={[S.tabText, active && S.tabTextActive]}>{tab}</Text>
              {active && <View style={S.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator color={C.accent} /></View>
      ) : activeTab === 'Items' ? (
        /* Items — the user's gear library */
        allItems.length === 0 ? (
          <View style={S.empty}>
            <Text style={S.emptyText}>No items yet</Text>
            <Text style={S.emptyHint}>Scan some gear and it’ll show up here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={S.piecesGridWrap} showsVerticalScrollIndicator={false}>
            <View style={S.piecesGrid}>
              {allItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[S.pieceCard, { width: PIECE_COL }]}
                  onPress={() => setOpenedItem(item)}
                  activeOpacity={0.85}
                >
                  <View style={[S.pieceThumb, { height: PIECE_COL }]}>
                    {item.photoBase64 ? (
                      <Image source={{ uri: imageUri(item.photoBase64, 'image/png') }} style={S.pieceImg} resizeMode="contain" />
                    ) : (
                      <Text style={S.pieceNoImg}>No photo</Text>
                    )}
                    {item.isPublic && (
                      <View style={S.publicBadge}><Text style={S.publicBadgeText}>Public</Text></View>
                    )}
                  </View>
                  <Text style={S.pieceName} numberOfLines={1}>{item.product?.product_name || 'Unnamed'}</Text>
                  <View style={S.pieceMetaRow}>
                    <Text style={S.pieceCat} numberOfLines={1}>{item.product?.category || 'gear'}</Text>
                    {item.product?.price != null && (
                      <Text style={S.piecePrice}>${Number(item.product.price).toLocaleString()}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )
      ) : (
        /* Setups — the user's saved setups */
        <ScrollView contentContainerStyle={S.grid} showsVerticalScrollIndicator={false}>
          <View style={S.fitsHeader}>
            <TouchableOpacity style={S.newBtn} onPress={openModal}>
              <Text style={S.newBtnText}>+ New Setup</Text>
            </TouchableOpacity>
          </View>
          {setups.map((setup, index) => {
            const placements = setup.slots || {};
            const placed = Object.values(placements).filter(id => allItems.some(i => i.id === id)).length;
            return (
            <View
              key={setup.id}
              style={S.setupCardWrap}
              ref={index === 0 ? openSetupTarget.ref : undefined}
              onLayout={index === 0 ? openSetupTarget.onLayout : undefined}
            >
            <View style={S.setupCardHardShadow} />
            <View style={S.setupCard}>
              <TouchableOpacity
                onPress={() => onOpenSetup(setup)}
                activeOpacity={0.8}
              >
                <BoardPreview setup={setup} items={allItems} />
              </TouchableOpacity>
              <View style={S.setupFooter}>
                <TouchableOpacity style={S.setupFooterMain} onPress={() => onOpenSetup(setup)} activeOpacity={0.8}>
                  <Text style={S.setupName}>{setup.name}</Text>
                  <Text style={S.setupCount}>{placed} on board</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.deleteBtn}
                  onPress={() => handleDelete(setup)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={S.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            </View>
            );
          })}

          {setups.length === 0 && (
            <View style={S.empty}>
              <Text style={S.emptyText}>No setups yet</Text>
              <Text style={S.emptyHint}>Tap "+ New Setup" to get started</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Item detail */}
      <Modal
        visible={!!openedItem}
        animationType="slide"
        onRequestClose={() => setOpenedItem(null)}
      >
        <SafeAreaProvider>
          {openedItem && (
            <ProductDetailScreen
              item={openedItem}
              onBack={() => setOpenedItem(null)}
              onItemRemoved={() => {
                setOpenedItem(null);
                load();
              }}
              onOpenSetup={({ setup }) => {
                setOpenedItem(null);
                if (setup) onOpenSetup(setup);
              }}
            />
          )}
        </SafeAreaProvider>
      </Modal>

      {/* Profile photo + banner editor */}
      <Modal visible={showProfileEditor} transparent animationType="fade" onRequestClose={() => setShowProfileEditor(false)}>
        <View style={S.overlay}>
          <View style={S.profileEditor}>
            <View style={S.profileEditorHeader}>
              <View>
                <Text style={S.modalTitle}>Edit profile photos</Text>
                <Text style={S.profileEditorHint}>Choose a profile picture and banner.</Text>
              </View>
              <TouchableOpacity
                style={S.profileEditorClose}
                onPress={() => setShowProfileEditor(false)}
                disabled={!!savingProfileImage}
              >
                <Text style={S.profileEditorCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={S.bannerPicker}
              onPress={() => handlePickProfileImage('banner')}
              disabled={!!savingProfileImage}
              activeOpacity={0.84}
            >
              {bannerUri || fallbackBannerPhoto ? (
                <Image
                  source={{ uri: bannerUri || imageUri(fallbackBannerPhoto) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, S.bannerPickerEmpty]} />
              )}
              <View style={S.pickerScrim} />
              {savingProfileImage === 'banner' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={S.pickerLabel}>{bannerUri ? 'Change banner' : 'Add banner'}</Text>
              )}
            </TouchableOpacity>

            <View style={S.avatarPickerRow}>
              <TouchableOpacity
                style={S.avatarPicker}
                onPress={() => handlePickProfileImage('avatar')}
                disabled={!!savingProfileImage}
                activeOpacity={0.84}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, S.bannerAvatarFallback]}>
                    <Text style={S.editorAvatarInitial}>{avatarInitial}</Text>
                  </View>
                )}
                {savingProfileImage === 'avatar' && (
                  <View style={S.avatarSaving}><ActivityIndicator color="#FFFFFF" /></View>
                )}
              </TouchableOpacity>
              <View style={S.avatarPickerCopy}>
                <Text style={S.avatarPickerTitle}>Profile picture</Text>
                <Text style={S.profileEditorHint}>A square photo works best.</Text>
                <TouchableOpacity
                  style={S.choosePhotoBtn}
                  onPress={() => handlePickProfileImage('avatar')}
                  disabled={!!savingProfileImage}
                >
                  <Text style={S.choosePhotoBtnText}>{avatarUrl ? 'Change photo' : 'Add photo'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={S.profileDoneBtn}
              onPress={() => setShowProfileEditor(false)}
              disabled={!!savingProfileImage}
            >
              <Text style={S.profileDoneText}>{savingProfileImage ? 'Saving…' : 'Done'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New setup modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={S.overlay}>
          <View style={S.modal}>

            {modalStep === 1 ? (
              <>
                <Text style={S.modalTitle}>Name your setup</Text>
                <TextInput
                  style={S.input}
                  placeholder="e.g. Main Rig, Work Setup, Bedroom..."
                  placeholderTextColor="#ADADAD"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  onSubmitEditing={handleNext}
                  returnKeyType="next"
                />
                <View style={S.modalBtns}>
                  <TouchableOpacity style={S.cancelBtn} onPress={closeModal}>
                    <Text style={S.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.createBtn, !newName.trim() && S.createBtnDisabled]}
                    onPress={handleNext}
                    disabled={!newName.trim()}
                  >
                    <Text style={S.createText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={S.modalTitle}>What kind of setup?</Text>
                <Text style={S.modalSub}>"{newName}"</Text>
                <View style={S.typeGrid}>
                  {SETUP_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[S.typeBtn, newType === t.key && S.typeBtnActive]}
                      onPress={() => setNewType(t.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[S.typeBtnText, newType === t.key && S.typeBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={S.modalBtns}>
                  <TouchableOpacity style={S.cancelBtn} onPress={() => setModalStep(1)}>
                    <Text style={S.cancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.createBtn, (!newType || creating) && S.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!newType || creating}
                  >
                    <Text style={S.createText}>{creating ? 'Creating...' : 'Create'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>

      {/* Tutorial: spotlight the Setups tab; tapping through switches the tab
          and the setup-card step follows. */}
      {setupsStep.active && (
        <TutorialOverlay
          presentation="modal"
          steps={TUTORIAL_STEPS}
          stepIndex={setupsStep.stepIndex}
          targetRect={setupsTarget.rect}
          onTargetPress={() => { advanceTutorial('setups-tab'); setActiveTab('Setups'); }}
          onSkip={skipTutorial}
        />
      )}

      {/* Tutorial: spotlight the onboarding-built setup; tapping opens its
          board and the finale confetti follows. */}
      {openSetupStep.active && setups.length > 0 && (
        <TutorialOverlay
          presentation="modal"
          steps={TUTORIAL_STEPS}
          stepIndex={openSetupStep.stepIndex}
          targetRect={openSetupTarget.rect}
          onTargetPress={() => { advanceTutorial('open-setup'); onOpenSetup(setups[0]); }}
          onSkip={skipTutorial}
        />
      )}
    </View>
  );
}

const C = { bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#6E6E73', slot: '#FAFAFA', filled: '#F0F0F0', accent: '#6D5EF0' };

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Banner hero ────────────────────────────────────────────────────────────
  banner: { width: '100%', minHeight: 300, justifyContent: 'space-between', overflow: 'hidden' },
  bannerPlaceholder: { backgroundColor: '#2A2A2E' },
  bannerScrim: { backgroundColor: 'rgba(0,0,0,0.32)' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  bannerBack: { width: 30, alignItems: 'center', justifyContent: 'center' },
  bannerBackText: { color: '#FFFFFF', fontSize: 30, fontWeight: '300' },
  bannerAvatarButton: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'transparent', overflow: 'hidden',
  },
  bannerAvatar: { width: '100%', height: '100%', borderRadius: 27 },
  bannerAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#4E6FA8' },
  bannerAvatarText: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  bannerBody: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 22, gap: 10 },
  bannerName: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  bannerStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bannerStat: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  bannerStatNum: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  bannerDot: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  bannerBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  bannerBtn: {
    backgroundColor: 'rgba(60,60,64,0.78)', borderRadius: 22,
    paddingVertical: 11, paddingHorizontal: 26,
  },
  bannerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 36 },
  backText: { color: C.text, fontSize: 28, fontWeight: '300' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '600' },

  profile: { alignItems: 'center', paddingBottom: 24, gap: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2a4a7a', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  username: { color: C.text, fontSize: 20, fontWeight: '700' },
  handle: { color: C.sub, fontSize: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 28 },
  stat: { alignItems: 'center', gap: 2 },
  statNum: { color: C.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: C.sub, fontSize: 12 },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  newBtn: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 7, paddingHorizontal: 14 },
  newBtnText: { color: C.text, fontSize: 13, fontWeight: '500' },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12 },
  tabText: { color: C.sub, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: C.text, fontWeight: '800' },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2.5, width: '55%', borderRadius: 2, backgroundColor: C.text },

  // ── Pieces grid ──────────────────────────────────────────────────────────
  piecesGridWrap: { paddingHorizontal: PIECE_PAD, paddingTop: 16, paddingBottom: 60 },
  piecesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: PIECE_GAP },
  pieceCard: {},
  pieceThumb: {
    width: '100%', borderRadius: 12, borderWidth: 1.5, borderColor: '#161616',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 6,
  },
  pieceImg: { width: '82%', height: '82%' },
  pieceNoImg: { color: C.sub, fontSize: 10 },
  pieceName: { color: C.text, fontSize: 12.5, fontWeight: '700' },
  pieceMetaRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginTop: 1 },
  pieceCat: { flex: 1, color: C.sub, fontSize: 11 },
  piecePrice: { color: C.text, fontSize: 11.5, fontWeight: '800' },
  publicBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(22,22,22,0.82)', borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 7,
  },
  publicBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  fitsHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingBottom: 6 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: 20, paddingBottom: 60, gap: 18 },

  // White card + black border + hard offset shadow — same treatment as the
  // option cards on the AI Revamp menu, so setups feel like part of the set.
  setupCardWrap: { position: 'relative' },
  setupCardHardShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 16,
  },
  setupCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: '#161616', overflow: 'hidden' },

  // Absolute-positioned grid (gap baked into coordinates via computeLayout), so
  // no padding/gap here — matches the builder + setup Board tab exactly.
  // Warm board tone (same as the RevampScreen board) so the white slots pop.
  previewBoard: { backgroundColor: '#F0EFEA', marginHorizontal: 12, marginVertical: 12, borderRadius: 16, position: 'relative' },
  previewSlot: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewSlotFilled: { backgroundColor: '#FFFFFF', borderStyle: 'solid', borderColor: '#E3E0D8', borderWidth: 1 },
  previewSlotImage: { width: '85%', height: '80%' },
  previewSlotContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  previewPlus: { color: C.sub, fontSize: 16, fontWeight: '300', lineHeight: 18 },
  previewLabel: { color: C.sub, fontSize: 11, fontWeight: '500' },
  previewLabelRotated: { transform: [{ rotate: '90deg' }] },
  previewPriceBadge: {
    position: 'absolute', top: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(22,22,22,0.86)',
    borderTopRightRadius: 16, borderBottomLeftRadius: 12,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  previewPriceText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },

  setupFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#EEEBE3',
  },
  setupFooterMain: { flex: 1 },
  setupName: { color: C.text, fontSize: 16, fontWeight: '700' },
  setupCount: { color: C.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  // Red pill with a black border — same shape as the board "Save" pill.
  deleteBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#161616',
    backgroundColor: '#E5484D',
    minWidth: 64, alignItems: 'center',
  },
  deleteBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: C.sub, fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modal: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '85%', gap: 16, borderWidth: 1, borderColor: C.border },
  profileEditor: {
    backgroundColor: C.card, borderRadius: 22, padding: 20, width: '90%', gap: 18,
    borderWidth: 1.5, borderColor: '#161616',
  },
  profileEditorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  profileEditorHint: { color: C.sub, fontSize: 12.5, marginTop: 4 },
  profileEditorClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F0ED', alignItems: 'center', justifyContent: 'center' },
  profileEditorCloseText: { color: C.text, fontSize: 25, lineHeight: 27, fontWeight: '300' },
  bannerPicker: { height: 128, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bannerPickerEmpty: { backgroundColor: '#34343A' },
  pickerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  avatarPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarPicker: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden', borderWidth: 2, borderColor: '#161616' },
  avatarSaving: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  editorAvatarInitial: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  avatarPickerCopy: { flex: 1 },
  avatarPickerTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  choosePhotoBtn: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 18, borderWidth: 1.2, borderColor: '#161616', paddingVertical: 8, paddingHorizontal: 14 },
  choosePhotoBtnText: { color: C.text, fontSize: 12.5, fontWeight: '700' },
  profileDoneBtn: { backgroundColor: '#161616', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  profileDoneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalSub: { color: C.sub, fontSize: 14, marginTop: -8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { width: '47%', paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.slot, alignItems: 'center', justifyContent: 'center' },
  typeBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(109,94,240,0.1)' },
  typeBtnText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: C.accent },
  input: { backgroundColor: C.slot, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, paddingVertical: 12, paddingHorizontal: 14 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: C.sub, fontSize: 15 },
  createBtn: { flex: 1, borderRadius: 12, backgroundColor: C.accent, paddingVertical: 13, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
