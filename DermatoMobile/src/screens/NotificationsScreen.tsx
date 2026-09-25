import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, LayoutAnimation, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationOut,
} from '../api/client';
import { COLORS } from '../constants';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { Bell } from 'lucide-react-native';

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

// The backend's `link` field points at web routes ("/", "/progress/{id}") —
// this app only has the logged-in patient's own data, so it just needs to
// know which tab that corresponds to. "/" is the web Analyze page (its root
// route, not "/analyze" — there is no such route) and is what recheck_due
// and checkin_reminder both link to for "come scan again".
function tabForLink(link: string | null | undefined): string | null {
  if (!link) return null;
  if (link === '/' || link.startsWith('/analyze')) return 'Analyze';
  if (link.startsWith('/progress')) return 'Progress';
  return null;
}

const PAGE_SIZE = 30;

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getNotifications(PAGE_SIZE, 0);
      setNotifications(data);
      setHasMore(data.length === PAGE_SIZE);
      setError('');
    } catch {
      setError("Couldn't load your notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data } = await getNotifications(PAGE_SIZE, notifications.length);
      setNotifications((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // Leave hasMore as-is -- a failed "load more" just means the button stays put to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handlePress = async (n: NotificationOut) => {
    if (!n.is_read) {
      LayoutAnimation.easeInEaseOut();
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    const tab = tabForLink(n.link);
    if (tab) navigation.navigate('MainTabs', { screen: tab });
  };

  const handleMarkAll = async () => {
    LayoutAnimation.easeInEaseOut();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAll}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title}>Notifications</Text>
      {error && notifications.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
          ListEmptyComponent={
            !loading ? <EmptyState icon={Bell} title="You're all caught up" description="No notifications yet." /> : undefined
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMore}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load more notifications"
              >
                {loadingMore ? <ActivityIndicator size="small" color={COLORS.teal} /> : <Text style={styles.loadMoreText}>Load more</Text>}
              </TouchableOpacity>
            ) : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.cardUnread]}
              onPress={() => handlePress(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.is_read ? '' : 'Unread: '}${item.message}`}
            >
              {!item.is_read && <View style={styles.dot} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading, paddingHorizontal: 20, marginTop: 8 },
  backLink: { fontSize: 14, fontWeight: '600', color: COLORS.teal },
  markAll: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.teal, marginTop: 5 },
  message: { fontSize: 13, color: '#374151', lineHeight: 18 },
  time: { fontSize: 11, color: COLORS.mutedGray, marginTop: 4 },
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 10,
    marginTop: 4,
  },
  loadMoreText: { color: COLORS.teal, fontWeight: '600', fontSize: 13 },
});
