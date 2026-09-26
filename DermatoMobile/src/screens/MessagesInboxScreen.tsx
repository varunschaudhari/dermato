import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MessageCircle, ChevronRight } from 'lucide-react-native';
import { useSelectedPatient } from '../context/SelectedPatientContext';
import { getMessagesInbox, MessageInboxItem } from '../api/client';
import { COLORS } from '../constants';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

type RootStackParamList = { Messages: undefined };

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MessagesInboxScreen() {
  const { setSelectedPatient } = useSelectedPatient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<MessageInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMessagesInbox();
      setItems(data);
      setError('');
    } catch {
      setError("Couldn't load your messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openThread = (item: MessageInboxItem) => {
    setSelectedPatient(item.patient_id, item.patient_name);
    navigation.navigate('Messages');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      {error && items.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.patient_id)}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.teal} />}
          ListEmptyComponent={
            !loading ? <EmptyState icon={MessageCircle} title="No conversations yet" description="Messages from your patients will show up here." /> : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => openThread(item)}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${item.patient_name}`}
            >
              {item.unread_count > 0 && <View style={styles.dot} />}
              <View style={{ flex: 1 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.name}>{item.patient_name}</Text>
                  {item.last_message_at && <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>}
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message ? `${item.last_sender_name ? `${item.last_sender_name}: ` : ''}${item.last_message}` : 'No messages yet'}
                </Text>
              </View>
              <ChevronRight size={18} color={COLORS.mutedGray} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading, paddingHorizontal: 20, paddingTop: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.teal },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.heading },
  time: { fontSize: 11, color: COLORS.mutedGray },
  preview: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
});
