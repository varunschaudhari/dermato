import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePatientScope } from '../hooks/usePatientScope';
import { getPatientSessions, absoluteUrl, SessionOut } from '../api/client';
import { CONDITION_LABELS, SEVERITY_META, COLORS } from '../constants';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { ScanFace, ChevronRight, Search } from 'lucide-react-native';

type RootStackParamList = { Report: { sessionId: number } };

export default function HistoryScreen() {
  const { patientId, patientName, isOwn } = usePatientScope();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const dateStr = new Date(s.captured_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toLowerCase();
      if (dateStr.includes(q)) return true;
      if ((s.doctor_note || '').toLowerCase().includes(q)) return true;
      return Object.keys(CONDITION_LABELS).some((key) => {
        const level = (s as any)[`${key}_severity`];
        return level && (String(level).toLowerCase().includes(q) || CONDITION_LABELS[key].toLowerCase().includes(q));
      });
    });
  }, [sessions, search]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isOwn ? 'Scan History' : `${patientName}'s History`}</Text>
      {error && sessions.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
          ListHeaderComponent={
            sessions.length > 0 ? (
              <View style={styles.searchWrapper}>
                <Search size={16} color={COLORS.mutedGray} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by date, condition, note…"
                  placeholderTextColor={COLORS.mutedGray}
                />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            !loading ? (
              sessions.length === 0 ? (
                <EmptyState icon={ScanFace} title="No scans yet" description="Run your first analysis to start tracking." />
              ) : (
                <EmptyState icon={Search} title="No sessions match your search" description="Try a different date, condition, or word from a note." />
              )
            ) : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('Report', { sessionId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`View full report for the scan from ${new Date(item.captured_at).toLocaleDateString()}`}
            >
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
                <ChevronRight size={18} color={COLORS.mutedGray} />
              </View>
              {item.doctor_note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Doctor's note</Text>
                  <Text style={styles.noteText}>{item.doctor_note}</Text>
                </View>
              )}
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
  searchWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 12 },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 10,
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.heading,
    backgroundColor: '#fff',
  },
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
