import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as Linking from 'expo-linking';
import LoadingScreen from './components/LoadingScreen';
import OnboardingOpenerScreen from './screens/OnboardingOpenerScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import OnboardingBoardScreen from './screens/OnboardingBoardScreen';
import OnboardingCameraScreen from './screens/OnboardingCameraScreen';
import OnboardingAIRevampScreen from './screens/OnboardingAIRevampScreen';
import OnboardingSetupTypeScreen from './screens/OnboardingSetupTypeScreen';
import OnboardingStyleScreen from './screens/OnboardingStyleScreen';
import OnboardingAccountScreen from './screens/OnboardingAccountScreen';
import OnboardingFounderScreen from './screens/OnboardingFounderScreen';
import OnboardingProfileScreen from './screens/OnboardingProfileScreen';
import OnboardingTrialScreen from './screens/OnboardingTrialScreen';
import OnboardingBuildSetupScreen from './screens/OnboardingBuildSetupScreen';
import { createSetup, getSetups, getIsPremium, addSetupItem } from './config/setup';
import { initPurchases, hasProEntitlement, identifyPurchases, signOutPurchases } from './config/purchases';
import { supabase } from './config/supabase';
import { handleAuthRedirect, signOut, deleteAccount } from './config/auth';
import { imageUri } from './config/media';
import {
  TUTORIAL_STEPS, initTutorial, preloadTutorial, setTutorialUser, resetTutorialForNewAccount, clearTutorialFlag,
  advanceTutorial, jumpTutorial, rewindTutorial, completeTutorial, startTutorialAtStep,
  skipTutorial, isTutorialActive, useTutorialState, suppressTutorialForSignIn,
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
import SettingsScreen from './screens/SettingsScreen';
import RevampMenuScreen from './screens/RevampMenuScreen';
import RevampSetupPickerScreen from './screens/RevampSetupPickerScreen';
import RevampCameraRollScreen from './screens/RevampCameraRollScreen';
import RevampScreen from './screens/RevampScreen';
import RevampPaywallScreen from './screens/RevampPaywallScreen';
import DevScreen from './screens/DevScreen';
import CommunityFeedbackScreen from './screens/CommunityFeedbackScreen';

const LOADING_SCREEN = require('./assets/loadingscreen.mp4');

// Warmed up on launch so the branding/onboarding media doesn't pop in. The
// loading screen shows while these download (they're served over the network in
// Expo Go on first use).
const PRELOAD_ASSETS = [
  LOADING_SCREEN,
  require('./assets/mascot.gif'),
  require('./assets/mascot_head.png'),
  require('./assets/onboarding_1.mp4'),
  require('./assets/onboardingnew4.mp4'),
  require('./assets/peeking_bot.png'),
  require('./assets/onboarding_trial_hero.png'),
  require('./assets/revamp_paywall_hero.png'),
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
const DEV_FORCE_ONBOARDING = false;

// A user's first-ever sign-in has created_at ≈ last_sign_in_at. Used to decide
// whether a login should run the first-run onboarding (founder note + build a
// board) or drop straight onto the feed. Email signup/signin carry an explicit
// isNewAccount flag; OAuth (Google/Apple) doesn't, so we infer it from the
// timestamps on the returned user.
function isFirstSignIn(user) {
  if (!user?.created_at) return false;
  const created = new Date(user.created_at).getTime();
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : created;
  return Math.abs(lastSignIn - created) < 5000; // within 5s → same session as signup
}

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

  // Configure RevenueCat once on launch (logs whether it connected).
  useEffect(() => { initPurchases(); }, []);

  // Keep the tutorial scoped to whoever is signed in. Fires on login, signup,
  // and logout — so a new account gets its own first-run tour even on a device
  // where another account already finished it.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      setTutorialUser(userId);
      // Keep RevenueCat's identity in sync so subscriptions are attributable to
      // this Supabase user (the webhook maps events by it).
      if (userId) identifyPurchases(userId);
      else signOutPurchases();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // The tutorial starts the first time the user lands on the feed — after
  // onboarding or straight away for returning-but-untutored accounts.
  useEffect(() => {
    if (ready && screen === 'home') initTutorial();
  }, [ready, screen]);

  // Show profile setup right after the first-run tutorial. Once the user
  // finishes their username, profile picture, and banner setup, that screen
  // advances to the trial offer.
  // Returning users who already finished go idle → done (never 'active'), so
  // they do not enter this first-run sequence again.
  const prevTutorialStatus = useRef(tutorial.status);
  useEffect(() => {
    const wasActive = prevTutorialStatus.current === 'active';
    prevTutorialStatus.current = tutorial.status;
    if (wasActive && tutorial.status === 'done') setScreen('onboarding-profile');
  }, [tutorial.status]);

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

      let session = sessionResult.data?.session || null;
      let sessionUser = null;

      // getSession() only reads the cached token — it can't tell that the
      // account was deleted or the token revoked. Confirm the user still exists
      // server-side before trusting it, otherwise a stale session strands the
      // app on a broken Home instead of returning to onboarding. A network
      // error (no auth status) is NOT treated as invalid, so offline users with
      // a real session stay logged in.
      if (session) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        const authInvalid = userError
          ? userError.status === 401 || userError.status === 403
          : !userData?.user;
        if (authInvalid) {
          await supabase.auth.signOut().catch(() => {});
          session = null; // fall through to the default 'onboarding' screen
        } else {
          sessionUser = userData.user;
        }
      }

      if (session) {
        try {
          // Premium is unlocked if EITHER the local flag or the RevenueCat
          // entitlement says so — the entitlement is the real source of truth
          // for anyone who actually purchased through the paywall.
          const [localPremium, pro] = await Promise.all([getIsPremium(), hasProEntitlement()]);
          setIsPremiumState(localPremium || pro);
        } catch (error) {
          console.warn('[app] premium status load failed:', error.message);
        }
        // Read this account's tutorial-completed flag now, while the loading
        // screen is up, so initTutorial can decide synchronously — no flash of
        // the bare feed on the handoff, and scoped per account.
        await preloadTutorial(sessionUser?.id);
        if (!active) return;
        // Dev flag keeps you on the onboarding flow to test the full first-run.
        if (!(__DEV__ && DEV_FORCE_ONBOARDING)) {
          initTutorial(); // decide the tour before Home first paints
          setScreen('home');
        }
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

  // Reflect Pro in the UI immediately after a purchase. is_premium in the DB is
  // now owned by the RevenueCat webhook (server-authoritative), so we no longer
  // write it from the client — the SDK entitlement + this local flag drive the
  // UI, and the webhook syncs the DB within seconds.
  const unlockPremium = () => setIsPremiumState(true);

  const openRevamp = () => setScreen(isPremium ? 'revamp-menu' : 'revamp-paywall');

  // Land on the feed and kick off the first-run tutorial in the SAME update, so
  // the store flip and the screen swap batch into one render — Home's first
  // frame already carries the tutorial overlay instead of flashing bare first.
  const goToFeed = () => {
    initTutorial();
    setScreen('home');
  };

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

  // Sign out and return to the onboarding opener. Clears session-scoped state so
  // nothing from the previous account bleeds into the next sign-in.
  const handleLogout = async () => {
    await signOut().catch(() => {});
    setActiveSetup(null);
    setIsPremiumState(false);
    setScreen('onboarding');
  };

  // Settings → "Delete account": permanently removes the account + data, then
  // returns to onboarding. The confirm lives in the Settings screen.
  const handleDeleteAccount = async () => {
    // Drop this account's tutorial flag first (while we still know who it is), so
    // a recycled user id for the same email starts the tour fresh.
    await clearTutorialFlag();
    const { error } = await deleteAccount();
    if (error) {
      Alert.alert('Could not delete account', error);
      return;
    }
    setActiveSetup(null);
    setIsPremiumState(false);
    setScreen('onboarding');
  };

  // Dev-only: jump to any screen from the DevScreen. Seeds a setup for the
  // screens that need one so they aren't blank.
  const devNavigate = async (key) => {
    const needsSetup = ['setup', 'board-builder', 'revamp', 'revamp-camera-roll'].includes(key);
    if (needsSetup && !activeSetup) {
      try {
        const setups = await getSetups();
        setActiveSetup(setups[0] || (await createSetup('Dev Setup', 'pc')));
      } catch (e) {
        console.warn('[dev] could not seed a setup:', e?.message || e);
      }
    }
    setScreen(key);
  };

  // Dev-only: jump straight to a tutorial step — route to its screen (seeding a
  // setup / choosing the right setup view where needed), then arm that step.
  const devStartTutorial = async (stepId) => {
    const map = {
      'home-add': 'home', 'pick-category': 'picker', 'camera-shutter': 'camera',
      'receipt-save': 'preview', 'cutout-reveal': 'home', 'profile-tab': 'home',
      'setups-tab': 'profile', 'open-setup': 'profile', 'arrange-board': 'setup',
      'drag-item': 'setup', 'photo-tab': 'setup', 'add-photo': 'setup',
      'edit-tags': 'setup', 'place-tag': 'setup', 'all-set': 'home',
    };
    const target = map[stepId] || 'home';
    if (target === 'setup') {
      setSetupInitialView(['add-photo', 'edit-tags', 'place-tag'].includes(stepId) ? 'photo' : 'board');
    }
    await devNavigate(target);
    startTutorialAtStep(stepId);
  };

  // Settings → "Subscription": Pro users manage/cancel via the store; free users
  // land on the paywall.
  const managePlan = () => {
    if (isPremium) {
      Alert.alert('mysetup Pro', "You're on Pro. Manage or cancel your subscription in your device's App Store / Play Store account settings.");
    } else {
      setScreen('revamp-paywall');
    }
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
        <OnboardingOpenerScreen
          onContinue={() => setScreen('onboarding-intro')}
        />
      );
    }
    if (screen === 'onboarding-intro') {
      return (
        <OnboardingScreen
          onContinue={() => setScreen('onboarding-board')}
          onBack={() => setScreen('onboarding')}
        />
      );
    }
    if (screen === 'onboarding-board') {
      return (
        <OnboardingBoardScreen
          onContinue={() => setScreen('onboarding-camera')}
          onBack={() => setScreen('onboarding-intro')}
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
          onContinue={(data) => {
            // "New" when the account screen says so (email signup) or, for OAuth
            // where that flag isn't set, when this is the user's first sign-in.
            const isNew = data?.isNewAccount ?? isFirstSignIn(data?.user);
            if (isNew) {
              // Fresh account gets the first-run journey: founder note → build a
              // board. A fresh signup also gets its own tutorial, even if the
              // email (and recycled user id) matches a just-deleted account.
              resetTutorialForNewAccount(data?.user?.id);
              setScreen('onboarding-founder');
            } else {
              // Returning user signing in — never show the first-run tutorial,
              // and skip the founder note / build-a-board step; go to the feed.
              suppressTutorialForSignIn(data?.user?.id);
              goToFeed();
            }
          }}
          onBack={() => setScreen('onboarding-style')}
          onSkip={goToFeed}
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
    if (screen === 'onboarding-profile') {
      return (
        <OnboardingProfileScreen
          onDone={() => setScreen('onboarding-trial')}
        />
      );
    }
    if (screen === 'onboarding-trial') {
      return (
        <OnboardingTrialScreen
          onUnlock={async () => { await unlockPremium(); setScreen('home'); }}
          onClose={() => setScreen('home')}
        />
      );
    }
    if (screen === 'onboarding-build-setup') {
      return (
        <OnboardingBuildSetupScreen
          onContinue={startFirstBuild}
          onSkip={goToFeed}
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
          onBack={() => { rewindTutorial('pick-category'); setScreen('picker'); }}
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
            // Finishing the onboarding build drops the user on the feed — start
            // the tutorial in the same update so it doesn't flash bare first.
            if (afterBoardBuilder === 'home') { goToFeed(); }
            else setScreen(afterBoardBuilder);
            setAfterBoardBuilder('setup');
          }}
          onCancel={() => {
            if (afterBoardBuilder === 'revamp-camera-roll') {
              setScreen('revamp-camera-roll');
              setAfterBoardBuilder('setup');
            } else if (afterBoardBuilder === 'home') {
              // Backing out of the onboarding build still lands on the feed —
              // onboarding is over either way, so don't strand them in Profile.
              goToFeed();
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
          onBack={() => { rewindTutorial('pick-category'); setScreen('picker'); }}
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
          onUnlock={async () => { await unlockPremium(); setScreen('revamp-menu'); }}
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
    if (screen === 'settings') {
      return (
        <SettingsScreen
          onBack={() => setScreen('home')}
          onOpenProfile={() => setScreen('profile')}
          onLogout={handleLogout}
          onManagePlan={managePlan}
          onDeleteAccount={handleDeleteAccount}
          onCommunityFeedback={() => setScreen('community-feedback')}
          isPremium={isPremium}
        />
      );
    }
    if (screen === 'community-feedback') {
      return <CommunityFeedbackScreen onBack={() => setScreen('settings')} />;
    }
    if (screen === 'dev') {
      return <DevScreen onNavigate={devNavigate} onStartStep={devStartTutorial} onClose={() => setScreen('home')} />;
    }
    return (
      <HomeScreen
        onStartScan={() => setScreen('picker')}
        onViewSetup={() => setScreen('profile')}
        onRevamp={openRevamp}
        onSearch={() => setScreen('search')}
        onOpenSettings={() => setScreen('settings')}
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

      {/* Dev-only launcher for the screen navigator. Stripped from prod builds. */}
      {__DEV__ && screen !== 'dev' && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={() => setScreen('dev')}
          activeOpacity={0.8}
        >
          <Text style={styles.devButtonText}>DEV</Text>
        </TouchableOpacity>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  loadingMedia: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  devButton: {
    position: 'absolute', left: 12, bottom: 90,
    backgroundColor: 'rgba(138,226,52,0.92)', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 12, zIndex: 9999, elevation: 50,
  },
  devButtonText: { color: '#0E0E12', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});
