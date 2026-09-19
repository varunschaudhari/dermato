import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationOut,
} from '../api/client';

type RootStackParamList = { MainTabs: { screen: string } | undefined };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// The backend's `link` field points at web routes ("/analyze",
// "/progress/{id}") — this app only has the logged-in patient's own data, so
// it just needs to know which tab that corresponds to.
function tabForLink(link: string | null | undefined): string | null {
  if (!link) return null;
  if (link.startsWith('/analyze')) return 'Analyze';
  if (link.startsWith('/progress')) return 'Progress';
  return null;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handlePress = async (n: NotificationOut) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    const tab = tabForLink(n.link);
    if (tab) navigation.navigate('MainTabs', { screen: tab });
  };

  const handleMarkAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>You're all caught up — no notifications yet.</Text> : undefined
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_read && styles.cardUnread]}
            onPress={() => handlePress(item)}
          >
            {!item.is_read && <View style={styles.dot} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginTop: 8 },
  backLink: { fontSize: 14, fontWeight: '600', color: '#0d9488' },
  markAll: { fontSize: 12, fontWeight: '600', color: '#0d9488' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardUnread: { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0d9488', marginTop: 5 },
  message: { fontSize: 13, color: '#374151', lineHeight: 18 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
