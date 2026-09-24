import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarPlus, Clock, CalendarClock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  getAppointments,
  getAvailableDoctors,
  getDoctorBusyTimes,
  getAvailableSlots,
  createAppointment,
  updateAppointmentStatus,
  getErrorMessage,
  AppointmentOut,
  AvailableSlots,
  DoctorOption,
} from '../api/client';
import { COLORS } from '../constants';
import FormError from '../components/FormError';
import EmptyState from '../components/EmptyState';

function nextDays(n: number): { dateStr: string; weekday: string; dayNum: string }[] {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ dateStr, weekday: d.toLocaleDateString(undefined, { weekday: 'short' }), dayNum: String(d.getDate()) });
  }
  return days;
}

const UPCOMING_DAYS = nextDays(14);

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
  const [busyTimes, setBusyTimes] = useState<string[]>([]);
  const [slots, setSlots] = useState<AvailableSlots | null>(null);

  useEffect(() => {
    if (!doctorId || !date) {
      setBusyTimes([]);
      setSlots(null);
      return;
    }
    getDoctorBusyTimes(doctorId, date)
      .then(({ data }) => setBusyTimes(data))
      .catch(() => setBusyTimes([])); // malformed/in-progress date input -- just show nothing rather than an error
    getAvailableSlots(doctorId, date)
      .then(({ data }) => setSlots(data))
      .catch(() => setSlots(null));
  }, [doctorId, date]);

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
      {error ? <FormError message={error} /> : null}

      <Text style={styles.fieldLabel}>Dermatologist</Text>
      <View style={styles.doctorRow}>
        {doctors.map((d) => {
          const active = doctorId === d.id;
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.doctorChip, active && styles.doctorChipActive]}
              onPress={() => {
                setDoctorId(d.id);
                setTime('');
              }}
            >
              {d.avatar_url ? (
                <Image source={{ uri: d.avatar_url }} style={styles.doctorAvatar} />
              ) : (
                <View style={[styles.doctorAvatarFallback, active && styles.doctorAvatarFallbackActive]}>
                  <Text style={[styles.doctorAvatarFallbackText, active && styles.doctorAvatarFallbackTextActive]}>
                    {(d.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>{d.full_name}</Text>
                {d.specialization ? (
                  <Text style={[styles.doctorChipSubtext, active && styles.doctorChipSubtextActive]}>{d.specialization}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStripContent}>
        {UPCOMING_DAYS.map((d) => {
          const active = date === d.dateStr;
          return (
            <TouchableOpacity
              key={d.dateStr}
              style={[styles.dayChip, active && styles.doctorChipActive]}
              onPress={() => {
                setDate(d.dateStr);
                setTime('');
              }}
            >
              <Text style={[styles.dayChipWeekday, active && styles.doctorChipTextActive]}>{d.weekday}</Text>
              <Text style={[styles.dayChipNum, active && styles.doctorChipTextActive]}>{d.dayNum}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {doctorId && date && slots?.configured && (
        <>
          <Text style={styles.fieldLabel}>Available times</Text>
          {slots.slots.length === 0 ? (
            <Text style={styles.hintText}>No open slots that day — try another date.</Text>
          ) : (
            <View style={styles.doctorRow}>
              {slots.slots.map((t) => {
                const timeValue = new Date(t).toTimeString().slice(0, 5);
                const active = time === timeValue;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.slotChip, active && styles.doctorChipActive]}
                    onPress={() => setTime(timeValue)}
                  >
                    <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>
                      {new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      {doctorId && date && slots && !slots.configured && (
        <>
          <Text style={styles.fieldLabel}>Time</Text>
          <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM (24h)" placeholderTextColor={COLORS.mutedGray} />
          <Text style={styles.hintText}>This doctor hasn't set up available hours yet — pick any time.</Text>
          {busyTimes.length > 0 && (
            <Text style={styles.busyTimesText}>
              Already booked that day:{' '}
              {busyTimes
                .map((t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))
                .join(', ')}
            </Text>
          )}
        </>
      )}

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
          <EmptyState icon={CalendarClock} title="No upcoming appointments" />
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
  busyTimesText: { fontSize: 12, color: '#d97706', marginTop: 8 },
  hintText: { fontSize: 12, color: COLORS.mutedGray, marginTop: 4, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.heading, backgroundColor: '#fff' },
  doctorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  doctorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 20,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
  },
  doctorChipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  doctorChipText: { fontSize: 12, color: COLORS.heading, fontWeight: '600' },
  doctorChipTextActive: { color: '#fff' },
  doctorChipSubtext: { fontSize: 10, color: COLORS.mutedGray, marginTop: 1 },
  doctorChipSubtextActive: { color: 'rgba(255,255,255,0.8)' },
  doctorAvatar: { width: 24, height: 24, borderRadius: 12 },
  doctorAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorAvatarFallbackActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  doctorAvatarFallbackText: { fontSize: 10, fontWeight: '700', color: COLORS.teal },
  doctorAvatarFallbackTextActive: { color: '#fff' },
  dayStripContent: { gap: 8, paddingVertical: 2 },
  dayChip: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 12,
  },
  dayChipWeekday: { fontSize: 11, color: COLORS.mutedGray, fontWeight: '600' },
  dayChipNum: { fontSize: 15, color: COLORS.heading, fontWeight: '700', marginTop: 2 },
  slotChip: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  saveButton: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  apptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  apptDoctor: { fontSize: 14, fontWeight: '600', color: COLORS.heading },
  apptTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  apptTime: { fontSize: 12, color: COLORS.mutedGray },
  apptReason: { fontSize: 12, color: COLORS.mutedGray, marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cancelLink: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
});
