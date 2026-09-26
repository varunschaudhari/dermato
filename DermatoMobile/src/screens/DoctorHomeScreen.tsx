import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Users, Clock, MessageCircle, CalendarClock, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSelectedPatient } from '../context/SelectedPatientContext';
import { useToast } from '../context/ToastContext';
import {
  getPatients,
  getOverdueRecheck,
  getMessagesInbox,
  getAppointments,
  assignDoctor,
  PatientOut,
  OverdueRecheckOut,
  MessageInboxItem,
  AppointmentOut,
} from '../api/client';
import { COLORS } from '../constants';
import EmptyState from '../components/EmptyState';

type RootStackParamList = { Progress: undefined; Messages: undefined; Appointments: undefined };

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function DoctorHomeScreen() {
  const { fullName } = useAuth();
  const { setSelectedPatient } = useSelectedPatient();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [patients, setPatients] = useState<PatientOut[]>([]);
  const [overdue, setOverdue] = useState<OverdueRecheckOut[]>([]);
  const [inbox, setInbox] = useState<MessageInboxItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o, m, a] = await Promise.all([getPatients(), getOverdueRecheck(), getMessagesInbox(), getAppointments()]);
      setPatients(p.data);
      setOverdue(o.data);
      setInbox(m.data);
      setAppointments(a.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unclaimed = useMemo(() => patients.filter((p) => !p.assigned_doctor_id), [patients]);
  const needsReply = useMemo(() => inbox.filter((i) => i.unread_count > 0), [inbox]);
  const unreadTotal = useMemo(() => inbox.reduce((sum, i) => sum + i.unread_count, 0), [inbox]);
  const todaysAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'scheduled' && isToday(a.scheduled_at)).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments]
  );

  // Priority order: unclaimed patients need a home before anything else,
  // then overdue rechecks, then unread messages -- matches web's Worklist.
  const priorityMessage = unclaimed.length > 0
    ? `${unclaimed.length} patient${unclaimed.length === 1 ? '' : 's'} waiting to be claimed`
    : overdue.length > 0
    ? `${overdue.length} patient${overdue.length === 1 ? '' : 's'} overdue for a recheck`
    : unreadTotal > 0
    ? `${unreadTotal} unread message${unreadTotal === 1 ? '' : 's'}`
    : "You're all caught up";

  const openPatient = (id: number, name: string) => {
    setSelectedPatient(id, name);
    navigation.navigate('Progress');
  };

  const openThread = (id: number, name: string) => {
    setSelectedPatient(id, name);
    navigation.navigate('Messages');
  };

  const handleClaim = async (p: PatientOut) => {
    setClaimingId(p.id);
    try {
      await assignDoctor(p.id);
      setPatients((prev) => prev.filter((x) => x.id !== p.id));
      toast.success(`${p.name} is now your patient.`);
    } catch {
      toast.error("Couldn't claim this patient. Try again.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.teal} />}
    >
      <Text style={styles.title}>{fullName ? `Hi ${fullName.split(' ')[0]}` : 'Worklist'}</Text>

      <View style={styles.priorityBanner}>
        <Text style={styles.priorityText}>{priorityMessage}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Users size={16} color={COLORS.teal} />
          <Text style={styles.statNumber}>{unclaimed.length}</Text>
          <Text style={styles.statLabel}>Unclaimed</Text>
        </View>
        <View style={styles.statTile}>
          <Clock size={16} color={COLORS.teal} />
          <Text style={styles.statNumber}>{overdue.length}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statTile}>
          <MessageCircle size={16} color={COLORS.teal} />
          <Text style={styles.statNumber}>{unreadTotal}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Overdue Recheck</Text>
      <View style={styles.card}>
        {overdue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing overdue" />
        ) : (
          overdue.map((o) => (
            <TouchableOpacity
              key={`${o.patient_id}-${o.condition}`}
              style={styles.row}
              onPress={() => openPatient(o.patient_id, o.patient_name)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${o.patient_name}'s chart`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{o.patient_name}</Text>
                <Text style={styles.rowMeta}>{o.condition} · {o.remedy_type}</Text>
              </View>
              <Text style={styles.overdueTag}>{o.days_overdue}d overdue</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Unclaimed Patients</Text>
      <View style={styles.card}>
        {unclaimed.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No unclaimed patients" />
        ) : (
          unclaimed.map((p) => (
            <View key={p.id} style={styles.row}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openPatient(p.id, p.name)} accessibilityRole="button" accessibilityLabel={`Open ${p.name}'s chart`}>
                <Text style={styles.rowTitle}>{p.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.claimButton}
                disabled={claimingId === p.id}
                onPress={() => handleClaim(p)}
                accessibilityRole="button"
                accessibilityLabel={`Claim ${p.name} as your patient`}
              >
                <Text style={styles.claimButtonText}>{claimingId === p.id ? 'Claiming…' : 'Claim'}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Needs a Reply</Text>
      <View style={styles.card}>
        {needsReply.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No unread conversations" />
        ) : (
          needsReply.map((i) => (
            <TouchableOpacity
              key={i.patient_id}
              style={styles.row}
              onPress={() => openThread(i.patient_id, i.patient_name)}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${i.patient_name}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{i.patient_name}</Text>
                {i.last_message ? <Text style={styles.rowMeta} numberOfLines={1}>{i.last_message}</Text> : null}
              </View>
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{i.unread_count}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Today's Appointments</Text>
      <View style={styles.card}>
        {todaysAppointments.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing scheduled today" />
        ) : (
          todaysAppointments.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.row}
              onPress={() => navigation.navigate('Appointments')}
              accessibilityRole="button"
              accessibilityLabel={`${a.patient_name} at ${new Date(a.scheduled_at).toLocaleTimeString()}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.patient_name}</Text>
                {a.reason ? <Text style={styles.rowMeta}>{a.reason}</Text> : null}
              </View>
              <Text style={styles.rowMeta}>
                {new Date(a.scheduled_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading, marginBottom: 12 },
  priorityBanner: { backgroundColor: COLORS.tealSoft, borderRadius: 12, padding: 14, marginBottom: 16 },
  priorityText: { fontSize: 14, fontWeight: '700', color: COLORS.teal },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statTile: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 18, fontWeight: '700', color: COLORS.heading },
  statLabel: { fontSize: 11, color: COLORS.mutedGray },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.heading, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { fontSize: 13, fontWeight: '600', color: COLORS.heading },
  rowMeta: { fontSize: 11, color: COLORS.mutedGray, marginTop: 2 },
  overdueTag: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  claimButton: { borderWidth: 1, borderColor: COLORS.teal, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  claimButtonText: { color: COLORS.teal, fontSize: 12, fontWeight: '700' },
  unreadBadge: { backgroundColor: COLORS.teal, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
