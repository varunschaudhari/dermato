import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarPlus, Clock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  getAppointments,
  getAvailableDoctors,
  createAppointment,
  updateAppointmentStatus,
  getErrorMessage,
  AppointmentOut,
  DoctorOption,
} from '../api/client';
import { COLORS } from '../constants';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: '#f0fdfa', text: COLORS.teal },
  completed: { bg: '#ecfdf5', text: '#059669' },
  cancelled: { bg: '#f9fafb', text: COLORS.mutedGray },
};

function BookingForm({ doctors, onBooked }: { doctors: DoctorOption[]; onBooked: () => void }) {
  const { patientId } = useAuth();
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!patientId || !doctorId || !date || !time) return;
    setError('');
    setSaving(true);
    try {
      await createAppointment({
        patient_id: patientId,
        doctor_id: doctorId,
        scheduled_at: new Date(`${date}T${time}`).toISOString(),
        reason: reason || null,
      });
      setDoctorId(null);
      setDate('');
      setTime('');
      setReason('');
      onBooked();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Could not book appointment.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <CalendarPlus size={18} color={COLORS.teal} />
        <Text style={styles.cardTitle}>Book an Appointment</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.fieldLabel}>Dermatologist</Text>
      <View style={styles.doctorRow}>
        {doctors.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[styles.doctorChip, doctorId === d.id && styles.doctorChipActive]}
            onPress={() => setDoctorId(d.id)}
          >
            <Text style={[styles.doctorChipText, doctorId === d.id && styles.doctorChipTextActive]}>{d.full_name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.mutedGray} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Time</Text>
          <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM (24h)" placeholderTextColor={COLORS.mutedGray} />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Reason (optional)</Text>
      <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="e.g. Follow-up on acne treatment" placeholderTextColor={COLORS.mutedGray} />

      <TouchableOpacity
        style={[styles.saveButton, (!doctorId || !date || !time) && styles.saveButtonDisabled]}
        onPress={handleSubmit}
        disabled={saving || !doctorId || !date || !time}
        accessibilityRole="button"
        accessibilityLabel="Book Appointment"
      >
        <Text style={styles.saveButtonText}>{saving ? 'Booking…' : 'Book Appointment'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<AppointmentOut[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, d] = await Promise.all([getAppointments(), getAvailableDoctors()]);
      setAppointments(a.data);
      setDoctors(d.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCancel = async (id: number) => {
    await updateAppointmentStatus(id, 'cancelled');
    load();
  };

  const sorted = [...appointments].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  const upcoming = sorted.filter((a) => a.status === 'scheduled');
  const past = sorted.filter((a) => a.status !== 'scheduled');

  const renderAppointment = (appt: AppointmentOut) => {
    const meta = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
    return (
      <View key={appt.id} style={styles.apptRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.apptDoctor}>Dr. {appt.doctor_name}</Text>
          <View style={styles.apptTimeRow}>
            <Clock size={12} color={COLORS.mutedGray} />
            <Text style={styles.apptTime}>
              {new Date(appt.scheduled_at).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          </View>
          {appt.reason ? <Text style={styles.apptReason}>{appt.reason}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusBadgeText, { color: meta.text }]}>{appt.status}</Text>
          </View>
          {appt.status === 'scheduled' && (
            <TouchableOpacity onPress={() => handleCancel(appt.id)} accessibilityRole="button" accessibilityLabel="Cancel appointment">
              <Text style={styles.cancelLink}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.teal} />}
    >
      <Text style={styles.title}>Appointments</Text>
      <Text style={styles.subtitle}>Schedule and manage dermatology visits</Text>

      <BookingForm doctors={doctors} onBooked={load} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming appointments.</Text>
        ) : (
          upcoming.map(renderAppointment)
        )}
      </View>

      {past.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Past</Text>
          {past.map(renderAppointment)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading },
  subtitle: { fontSize: 13, color: COLORS.secondaryText, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.heading },
  fieldLabel: { fontSize: 12, color: COLORS.secondaryText, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.heading, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 10 },
  doctorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  doctorChip: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  doctorChipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  doctorChipText: { fontSize: 12, color: COLORS.heading, fontWeight: '600' },
  doctorChipTextActive: { color: '#fff' },
  saveButton: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 13 },
  emptyText: { fontSize: 13, color: COLORS.mutedGray },
  apptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  apptDoctor: { fontSize: 14, fontWeight: '600', color: COLORS.heading },
  apptTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  apptTime: { fontSize: 12, color: COLORS.mutedGray },
  apptReason: { fontSize: 12, color: COLORS.mutedGray, marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cancelLink: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
});
