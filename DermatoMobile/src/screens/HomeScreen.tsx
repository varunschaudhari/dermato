import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, User as UserIcon } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  getPatientSessions,
  getTreatmentPlans,
  getNotifications,
  getAppointments,
  SessionOut,
  TreatmentPlanOut,
  NotificationOut,
  AppointmentOut,
} from '../api/client';
import { computeSkinScoreFromSession, scoreMeta } from '../utils/skinScore';
import { computeTreatmentProgress } from '../utils/treatmentProgress';
import { CONDITION_LABELS, COLORS } from '../constants';
import ErrorState from '../components/ErrorState';

type TabParamList = { Home: undefined; Analyze: undefined; History: undefined; Progress: undefined };
// Notifications/Profile/Appointments live in the root Stack (siblings of
// MainTabs), same as Results/Messages — navigate() bubbles up to find them.
type RootStackParamList = { Notifications: undefined; Profile: undefined; Appointments: undefined };
type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type PriorityAlert = { key: string; kind: 'warning' | 'info'; message: string; actionLabel: string };

// Mirrors the web app's getPriorityAlert (PatientHomePage.jsx): surfaces the
// single most relevant thing right now, in the same priority order --
// overdue recheck > imminent appointment > unread notifications.
function getPriorityAlert(
  plans: TreatmentPlanOut[],
  notifications: NotificationOut[],
  upcomingAppointment?: AppointmentOut | null
): PriorityAlert | null {
  const overduePlan = plans.find(
    (p) => p.status === 'active' && p.expected_recheck_at && new Date(p.expected_recheck_at) < new Date()
  );
  if (overduePlan) {
    const label = CONDITION_LABELS[overduePlan.condition] || overduePlan.condition;
    return {
      key: 'overdue',
      kind: 'warning',
      message: `Your ${label} recheck is overdue — run a new analysis to see how it's progressing.`,
      actionLabel: 'Analyze now',
    };
  }
  if (upcomingAppointment) {
    const hoursAway = (new Date(upcomingAppointment.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursAway <= 48) {
      return {
        key: 'appointment',
        kind: 'info',
        message: `Appointment with Dr. ${upcomingAppointment.doctor_name} on ${new Date(upcomingAppointment.scheduled_at).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })}.`,
        actionLabel: 'View details',
      };
    }
  }
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  if (unreadCount > 0) {
    return {
      key: 'notifications',
      kind: 'info',
      message: `You have ${unreadCount} unread update${unreadCount === 1 ? '' : 's'} — tap to view.`,
      actionLabel: 'View',
    };
  }
  return null;
}

function recheckLabel(expectedRecheckAt?: string | null): { text: string; overdue: boolean } | null {
  if (!expectedRecheckAt) return null;
  const overdue = new Date(expectedRecheckAt) < new Date();
  const date = new Date(expectedRecheckAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { text: overdue ? `Recheck overdue since ${date}` : `Recheck due ${date}`, overdue };
}

export default function HomeScreen() {
  const { patientId, fullName, logout } = useAuth();
  const navigation = useNavigation<HomeNavigationProp>();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanOut[]>([]);
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [appointments, setAppointments] = useState<AppointmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [s, p, n, a] = await Promise.all([
        getPatientSessions(patientId),
        getTreatmentPlans(patientId),
        getNotifications(),
        getAppointments(),
      ]);
      setSessions(s.data);
      setPlans(p.data);
      setNotifications(n.data);
      setAppointments(a.data);
      setError('');
    } catch {
      setError("Couldn't load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // Refetch every time Home regains focus (e.g. right after a new analysis),
  // not just on first mount — mirrors the web app's 30s auto-refresh intent
  // without needing a polling timer on a phone.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latestSession = sessions[sessions.length - 1];
  const previousSession = sessions[sessions.length - 2];
  const score = computeSkinScoreFromSession(latestSession);
  const previousScore = computeSkinScoreFromSession(previousSession);
  const delta = score != null && previousScore != null ? score - previousScore : null;
  const meta = scoreMeta(score);
  const activePlans = plans.filter((p) => p.status === 'active');
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const upcomingAppointment = appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  const priorityAlert = getPriorityAlert(plans, notifications, upcomingAppointment);

  const handleAlertPress = () => {
    if (!priorityAlert) return;
    if (priorityAlert.key === 'overdue') navigation.navigate('Analyze');
    else if (priorityAlert.key === 'appointment') navigation.navigate('Appointments');
    else navigation.navigate('Notifications');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Welcome back{fullName ? `, ${fullName.split(' ')[0]}` : ''}</Text>
          <Text style={styles.subtitle}>Here's where your skin journey stands today</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <UserIcon size={20} color="#374151" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color="#374151" strokeWidth={2} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && sessions.length === 0 && plans.length === 0 && notifications.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {priorityAlert && (
            <TouchableOpacity
              style={[styles.alertBanner, priorityAlert.kind === 'warning' ? styles.alertWarning : styles.alertInfo]}
              onPress={handleAlertPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={priorityAlert.message}
            >
              <Text style={[styles.alertText, priorityAlert.kind === 'warning' ? styles.alertTextWarning : styles.alertTextInfo]}>
                {priorityAlert.message}
              </Text>
              <Text style={[styles.alertAction, priorityAlert.kind === 'warning' ? styles.alertTextWarning : styles.alertTextInfo]}>
                {priorityAlert.actionLabel} →
              </Text>
            </TouchableOpacity>
          )}

          {latestSession ? (
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>SKIN HEALTH SCORE</Text>
              <View style={styles.heroRow}>
                <Text style={styles.heroScore}>{score}</Text>
                <Text style={styles.heroOutOf}>/ 100</Text>
              </View>
              <View style={styles.heroFooterRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{meta.label}</Text>
                </View>
                {delta != null && delta !== 0 && (
                  <Text style={[styles.heroDelta, { color: delta > 0 ? '#86efac' : '#fca5a5' }]}>
                    {delta > 0 ? '↑' : '↓'} {delta > 0 ? '+' : ''}{delta} since last visit
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Progress')}
                accessibilityRole="button"
                accessibilityLabel="See full trend"
              >
                <Text style={styles.heroLink}>See full trend →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyHero}>
              <Text style={styles.emptyHeroText}>Take your first photo to get your skin health score.</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => navigation.navigate('Analyze')}
              accessibilityRole="button"
              accessibilityLabel="New Analysis"
            >
              <Text style={styles.primaryActionText}>New Analysis</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Progress')}
              accessibilityRole="button"
              accessibilityLabel="View Progress"
            >
              <Text style={styles.secondaryActionText}>View Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Appointments')}
              accessibilityRole="button"
              accessibilityLabel="Book Appointment"
            >
              <Text style={styles.secondaryActionText}>Book Appointment</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Treatments</Text>
            {activePlans.length === 0 ? (
              <Text style={styles.emptyText}>No active treatment plans right now.</Text>
            ) : (
              activePlans.map((p) => {
                const recheck = recheckLabel(p.expected_recheck_at);
                const progress = computeTreatmentProgress(p);
                return (
                  <View key={p.id} style={styles.treatmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.treatmentCondition}>{CONDITION_LABELS[p.condition] || p.condition}</Text>
                      {recheck && (
                        <Text style={[styles.treatmentRecheck, recheck.overdue && styles.treatmentRecheckOverdue]}>
                          {recheck.text}
                        </Text>
                      )}
                      {progress && (
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${progress.pct}%` }]} />
                          </View>
                          <Text style={styles.progressLabel}>
                            Day {progress.elapsedDays} of {progress.totalDays}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.treatmentBadge}>
                      <Text style={styles.treatmentBadgeText}>{p.remedy_type}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Recent Updates</Text>
              {notifications.length > 0 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Notifications')}
                  accessibilityRole="button"
                  accessibilityLabel="See all notifications"
                >
                  <Text style={styles.seeAllLink}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {notifications.length === 0 ? (
              <Text style={styles.emptyText}>Nothing new — you're all caught up.</Text>
            ) : (
              notifications.slice(0, 3).map((n) => (
                <View key={n.id} style={styles.updateRow}>
                  <Text style={[styles.updateText, !n.is_read && styles.updateTextUnread]} numberOfLines={2}>
                    {n.message}
                  </Text>
                  <Text style={styles.updateDate}>
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading },
  subtitle: { fontSize: 13, color: COLORS.secondaryText, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bellButton: { padding: 2 },
  bellDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  logout: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  alertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 12, padding: 13, marginBottom: 16 },
  alertWarning: { backgroundColor: '#fffbeb' },
  alertInfo: { backgroundColor: '#f0fdfa' },
  alertText: { flex: 1, fontSize: 13, fontWeight: '500' },
  alertAction: { fontSize: 12, fontWeight: '700' },
  alertTextWarning: { color: '#92400e' },
  alertTextInfo: { color: '#0f766e' },
  hero: { backgroundColor: '#0f766e', borderRadius: 16, padding: 20, marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  heroScore: { color: '#fff', fontSize: 44, fontWeight: '700' },
  heroOutOf: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 6 },
  heroFooterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroDelta: { fontSize: 12, fontWeight: '600' },
  heroLink: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginTop: 12 },
  emptyHero: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.divider },
  emptyHeroText: { color: COLORS.secondaryText, fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  primaryAction: { flex: 1, backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryAction: { flex: 1, borderWidth: 1, borderColor: COLORS.teal, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryActionText: { color: COLORS.teal, fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.heading },
  seeAllLink: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  emptyText: { fontSize: 13, color: COLORS.mutedGray },
  treatmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  treatmentCondition: { fontSize: 13, color: '#374151', fontWeight: '600' },
  treatmentRecheck: { fontSize: 11, color: COLORS.mutedGray, marginTop: 2 },
  treatmentRecheckOverdue: { color: '#d97706', fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.teal },
  progressLabel: { fontSize: 10, color: COLORS.mutedGray, flexShrink: 0 },
  treatmentBadge: { backgroundColor: '#ccfbf1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  treatmentBadgeText: { color: COLORS.teal, fontSize: 11, fontWeight: '600' },
  updateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: COLORS.border },
  updateText: { flex: 1, fontSize: 13, color: COLORS.secondaryText },
  updateTextUnread: { color: '#1f2937', fontWeight: '600' },
  updateDate: { fontSize: 11, color: COLORS.mutedGray },
});
