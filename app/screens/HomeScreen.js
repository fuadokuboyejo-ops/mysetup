import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, SafeAreaView,
} from 'react-native';

const MOCK_SETUPS = [
  {
    id: '1', username: 'jordan', initials: 'JR',
    description: 'walnut · minimal', likes: 412, comments: 38, trending: true,
    slots: { monitor: true, keyboard: true, mouse: false, tower: true },
  },
  {
    id: '2', username: 'sookie', initials: 'SK',
    description: 'white · gaming', likes: 287, comments: 21, trending: false,
    slots: { monitor: true, keyboard: true, mouse: true, tower: false },
  },
  {
    id: '3', username: 'marcus', initials: 'MC',
    description: 'black · productivity', likes: 534, comments: 61, trending: true,
    slots: { monitor: true, keyboard: false, mouse: true, tower: true },
  },
  {
    id: '4', username: 'priya', initials: 'PR',
    description: 'pastel · cozy', likes: 198, comments: 14, trending: false,
    slots: { monitor: false, keyboard: true, mouse: true, tower: false },
  },
];

const TABS = ['Trending', 'Following', 'New'];

function Avatar({ initials }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function MiniBoard({ slots }) {
  const SlotBox = ({ wide, tall, filled }) => (
    <View style={[
      styles.miniSlot,
      wide && styles.miniSlotWide,
      tall && styles.miniSlotTall,
      filled && styles.miniSlotFilled,
    ]} />
  );

  return (
    <View style={styles.miniBoard}>
      {/* Monitor row */}
      <View style={styles.miniMonitorRow}>
        <SlotBox wide filled={slots.monitor} />
      </View>
      {/* Bottom row */}
      <View style={styles.miniBottomRow}>
        <SlotBox filled={slots.keyboard} />
        <SlotBox tall filled={slots.mouse} />
        <SlotBox filled={slots.tower} />
      </View>
      <View style={styles.tapBadge}>
        <Text style={styles.tapBadgeText}>tap to explore</Text>
      </View>
    </View>
  );
}

function SetupCard({ setup, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* User row */}
      <View style={styles.cardHeader}>
        <Avatar initials={setup.initials} />
        <View style={styles.cardUserInfo}>
          <Text style={styles.cardUsername}>{setup.username}</Text>
          <Text style={styles.cardDescription}>{setup.description}</Text>
        </View>
        <TouchableOpacity style={styles.followBtn} activeOpacity={0.75}>
          <Text style={styles.followBtnText}>Follow</Text>
        </TouchableOpacity>
      </View>

      {/* Board preview */}
      <MiniBoard slots={setup.slots} />

      {/* Stats row */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statIcon}>♡</Text>
            <Text style={styles.statText}>{setup.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statIcon}>⌁</Text>
            <Text style={styles.statText}>{setup.comments}</Text>
          </TouchableOpacity>
        </View>
        {setup.trending && (
          <View style={styles.trendingBadge}>
            <Text style={styles.trendingIcon}>↑</Text>
            <Text style={styles.trendingText}>trending</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ onStartScan, onViewSetup, onRevamp }) {
  const [activeTab, setActiveTab] = useState('Trending');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>my setup</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIcon}>
              <Text style={styles.headerIconText}>⌕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Text style={styles.headerIconText}>♔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feed */}
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
        >
          {MOCK_SETUPS.map(setup => (
            <SetupCard key={setup.id} setup={setup} onPress={onViewSetup} />
          ))}
        </ScrollView>

      </SafeAreaView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={[styles.navIcon, styles.navIconActive]}>⌂</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⌕</Text>
          <Text style={styles.navLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navScanBtn} onPress={onStartScan}>
          <Text style={styles.navScanIcon}>⊕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onRevamp}>
          <Text style={styles.navIcon}>✨</Text>
          <Text style={styles.navLabel}>Revamp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onViewSetup}>
          <Text style={styles.navIcon}>⊙</Text>
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const C = {
  bg:     '#0c0c0e',
  card:   '#1a1a1d',
  slot:   '#242428',
  filled: '#2e2e33',
  border: '#2a2a2e',
  text:   '#f5f5f7',
  sub:    '#8e8e96',
  accent: '#ffffff',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  logo: { color: C.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', gap: 8 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { color: C.sub, fontSize: 17 },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  tab: {
    paddingVertical: 7, paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.card,
  },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.sub, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: C.bg, fontWeight: '700' },

  feed: { paddingHorizontal: 14, gap: 12, paddingBottom: 100 },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2a4a7a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardUserInfo: { flex: 1 },
  cardUsername: { color: C.text, fontSize: 15, fontWeight: '600' },
  cardDescription: { color: C.sub, fontSize: 12, marginTop: 1 },
  followBtn: {
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14,
  },
  followBtnText: { color: C.text, fontSize: 13, fontWeight: '500' },

  // Mini board
  miniBoard: {
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#141416',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 8,
    position: 'relative',
  },
  miniMonitorRow: { alignItems: 'center' },
  miniBottomRow: { flexDirection: 'row', gap: 7 },
  miniSlot: {
    flex: 1, height: 38,
    backgroundColor: C.slot,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333337',
    borderStyle: 'dashed',
  },
  miniSlotWide: { width: '60%', flex: 0 },
  miniSlotTall: { height: 52 },
  miniSlotFilled: { backgroundColor: C.filled, borderStyle: 'solid', borderColor: '#3a3a40' },
  tapBadge: {
    position: 'absolute', bottom: 14, right: 14,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  tapBadgeText: { color: C.bg, fontSize: 11, fontWeight: '600' },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerLeft: { flexDirection: 'row', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statIcon: { color: C.sub, fontSize: 15 },
  statText: { color: C.sub, fontSize: 13 },
  trendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendingIcon: { color: C.sub, fontSize: 13 },
  trendingText: { color: C.sub, fontSize: 13 },

  // Bottom nav
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: 28,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: { alignItems: 'center', justifyContent: 'center', width: 48, height: 36 },
  navIcon: { color: C.sub, fontSize: 20 },
  navIconActive: { color: C.accent },
  navLabel: { color: C.sub, fontSize: 9, marginTop: 2 },
  navLabelActive: { color: C.accent },
  navScanBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  navScanIcon: { color: C.bg, fontSize: 26, fontWeight: '300' },
});
