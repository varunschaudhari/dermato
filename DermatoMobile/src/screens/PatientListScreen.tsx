import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Users, ChevronRight, Search } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSelectedPatient } from '../context/SelectedPatientContext';
import { useToast } from '../context/ToastContext';
import { getPatients, assignDoctor, PatientOut } from '../api/client';
import { COLORS } from '../constants';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

// Root-Stack sibling, not a MainTabs screen -- Analyze/History/Progress live
// outside the dermatologist's tab bar and are only reached by explicitly
// navigating here first (see App.tsx and SelectedPatientContext).
type RootStackParamList = { Progress: undefined };

type FilterKey = 'all' | 'mine' | 'unclaimed';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'My Patients' },
  { key: 'unclaimed', label: 'Unclaimed' },
];

export default function PatientListScreen() {
  const { userId } = useAuth();
  const { setSelectedPatient } = useSelectedPatient();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [patients, setPatients] = useState<PatientOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPatients();
      setPatients([...data].sort((a, b) => a.name.localeCompare(b.name)));
      setError('');
    } catch {
      setError("Couldn't load your patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    let list = patients;
    if (filter === 'mine') list = list.filter((p) => p.assigned_doctor_id === userId);
    else if (filter === 'unclaimed') list = list.filter((p) => !p.assigned_doctor_id);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [patients, search, filter, userId]);

  const openPatient = (p: PatientOut) => {
    setSelectedPatient(p.id, p.name);
    navigation.navigate('Progress');
  };

  const handleClaim = async (p: PatientOut) => {
    setClaimingId(p.id);
    try {
      await assignDoctor(p.id, userId ?? undefined);
      setPatients((prev) => prev.map((x) => (x.id === p.id ? { ...x, assigned_doctor_id: userId } : x)));
      toast.success(`${p.name} is now your patient.`);
    } catch {
      toast.error("Couldn't claim this patient. Try again.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Patients</Text>
      {error && patients.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.teal} />}
          ListHeaderComponent={
            patients.length > 0 ? (
              <>
                <View style={styles.filterRow}>
                  {FILTERS.map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.filterChip, filter === key && styles.filterChipActive]}
                      onPress={() => setFilter(key)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: filter === key }}
                    >
                      <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.searchWrapper}>
                  <Search size={16} color={COLORS.mutedGray} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search patients by name…"
                    placeholderTextColor={COLORS.mutedGray}
                  />
                </View>
              </>
            ) : undefined
          }
          ListEmptyComponent={
            !loading ? (
              patients.length === 0 ? (
                <EmptyState icon={Users} title="No patients yet" description="Patients assigned to you (or unclaimed) will show up here." />
              ) : (
                <EmptyState icon={Search} title="No patients match your search" />
              )
            ) : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => openPatient(item)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}'s chart`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.age ? `${item.age} yrs` : 'Age unknown'}{item.skin_type ? ` · ${item.skin_type} skin` : ''}
                </Text>
              </View>
              {!item.assigned_doctor_id && (
                <TouchableOpacity
                  style={styles.claimButton}
                  disabled={claimingId === item.id}
                  onPress={() => handleClaim(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Claim ${item.name} as your patient`}
                >
                  <Text style={styles.claimButtonText}>{claimingId === item.id ? 'Claiming…' : 'Claim'}</Text>
                </TouchableOpacity>
              )}
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
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.secondaryText },
  filterChipTextActive: { color: '#fff' },
  claimButton: { borderWidth: 1, borderColor: COLORS.teal, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  claimButtonText: { color: COLORS.teal, fontSize: 12, fontWeight: '700' },
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
  name: { fontSize: 14, fontWeight: '600', color: COLORS.heading },
  meta: { fontSize: 12, color: COLORS.mutedGray, marginTop: 2 },
});
