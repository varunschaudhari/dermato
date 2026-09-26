import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { getPatients, PatientOut } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants';

interface Props {
  onSelect: (id: number, name: string) => void;
  placeholder?: string;
}

// Shared search+select control for "pick a patient" moments -- the Analyze
// gate (dermatologist arriving with no patient selected) and the
// Appointments booking-on-behalf form both need the same roster lookup.
// No server-side search/pagination exists on GET /patients/ (matches web's
// PatientsPage, which has the same limitation) -- fine at today's roster
// sizes, filtered client-side here too.
export default function PatientPickerField({ onSelect, placeholder }: Props) {
  const [patients, setPatients] = useState<PatientOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getPatients()
      .then((r) => setPatients(r.data))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <Search size={16} color={COLORS.mutedGray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder || 'Search patients by name…'}
          placeholderTextColor={COLORS.mutedGray}
        />
      </View>
      {loading ? (
        <Text style={styles.helperText}>Loading patients…</Text>
      ) : filtered.length === 0 ? (
        <Text style={styles.helperText}>No patients match.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.slice(0, 25).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.row}
              onPress={() => onSelect(p.id, p.name)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${p.name}`}
            >
              <Text style={styles.rowText}>{p.name}</Text>
              {!p.assigned_doctor_id && <Text style={styles.unclaimedTag}>Unclaimed</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  searchWrapper: { position: 'relative', justifyContent: 'center', marginBottom: SPACING.sm },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: RADIUS.sm,
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.heading,
    backgroundColor: '#fff',
  },
  helperText: { fontSize: 12, color: COLORS.mutedGray, paddingVertical: SPACING.sm },
  list: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: RADIUS.sm, overflow: 'hidden', maxHeight: 260 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#fff',
  },
  rowText: { fontSize: 13, color: COLORS.heading, fontWeight: '500' },
  unclaimedTag: { fontSize: 10, fontWeight: '700', color: '#d97706' },
});
