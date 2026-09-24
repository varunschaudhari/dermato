import React, { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getPatientSessions, absoluteUrl, SessionOut } from '../api/client';
import { CONDITION_LABELS, SEVERITY_META, COLORS } from '../constants';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { ScanFace } from 'lucide-react-native';

export default function HistoryScreen() {
  const { patientId } = useAuth();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const { data } = await getPatientSessions(patientId);
      setSessions([...data].reverse()); // newest first
      setError('');
    } catch {
      setError("Couldn't load your scan history.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan History</Text>
      {error && sessions.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
          ListEmptyComponent={
            !loading ? (
              <EmptyState icon={ScanFace} title="No scans yet" description="Run your first analysis to start tracking." />
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Image
                  source={{ uri: absoluteUrl(item.image_url) }}
                  style={styles.thumb}
                  accessibilityLabel={`Scan photo from ${new Date(item.captured_at).toLocaleDateString()}`}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.date}>
                    {new Date(item.captured_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                  <View style={styles.badgeRow}>
                    {Object.entries(CONDITION_LABELS).map(([key, label]) => {
                      const level = (item as any)[`${key}_severity`];
                      if (!level) return null;
                      const meta = SEVERITY_META[level];
                      return (
                        <View key={key} style={[styles.badge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.badgeText, { color: meta.color }]}>{label[0]}: {level}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
              {item.doctor_note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Doctor's note</Text>
                  <Text style={styles.noteText}>{item.doctor_note}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading, paddingHorizontal: 20, paddingTop: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: COLORS.divider },
  date: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  noteBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  noteLabel: { fontSize: 10, fontWeight: '700', color: COLORS.mutedGray, marginBottom: 2 },
  noteText: { fontSize: 12, color: '#374151', lineHeight: 17 },
});
