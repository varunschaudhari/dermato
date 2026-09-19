import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { getPatientSessions, getTreatmentPlans, SessionOut, TreatmentPlanOut } from '../api/client';
import { computeSkinScoreFromSession, scoreMeta } from '../utils/skinScore';
import { CONDITION_LABELS } from '../constants';

type TabParamList = { Home: undefined; Analyze: undefined; History: undefined; Progress: undefined };

export default function HomeScreen() {
  const { patientId, fullName, logout } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getPatientSessions(patientId), getTreatmentPlans(patientId)]);
      setSessions(s.data);
      setPlans(p.data);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // Refetch every time Home regains focus (e.g. right after a new analysis),
  // not just on first mount — mirrors the web app's 30s auto-refresh intent
  // without needing a polling timer on a phone.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latestSession = sessions[sessions.length - 1];
  const score = computeSkinScoreFromSession(latestSession);
  const meta = scoreMeta(score);
  const activePlans = plans.filter((p) => p.status === 'active');
  const overduePlan = activePlans.find((p) => p.expected_recheck_at && new Date(p.expected_recheck_at) < new Date());

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
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {overduePlan && (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueText}>
            Your {CONDITION_LABELS[overduePlan.condition] || overduePlan.condition} recheck is overdue — run a new
            analysis to see how it's progressing.
          </Text>
        </View>
      )}

      {latestSession ? (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>SKIN HEALTH SCORE</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroScore}>{score}</Text>
            <Text style={styles.heroOutOf}>/ 100</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{meta.label}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyHero}>
          <Text style={styles.emptyHeroText}>Take your first photo to get your skin health score.</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('Analyze')}>
          <Text style={styles.primaryActionText}>New Analysis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Progress')}>
          <Text style={styles.secondaryActionText}>View Progress</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Treatments</Text>
        {activePlans.length === 0 ? (
          <Text style={styles.emptyText}>No active treatment plans right now.</Text>
        ) : (
          activePlans.map((p) => (
            <View key={p.id} style={styles.treatmentRow}>
              <Text style={styles.treatmentCondition}>{CONDITION_LABELS[p.condition] || p.condition}</Text>
              <View style={styles.treatmentBadge}>
                <Text style={styles.treatmentBadgeText}>{p.remedy_type}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  logout: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  overdueBanner: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 16 },
  overdueText: { fontSize: 13, color: '#92400e' },
  hero: { backgroundColor: '#0f766e', borderRadius: 16, padding: 20, marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  heroScore: { color: '#fff', fontSize: 44, fontWeight: '700' },
  heroOutOf: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 6 },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyHero: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  emptyHeroText: { color: '#6b7280', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  primaryAction: { flex: 1, backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryAction: { flex: 1, borderWidth: 1, borderColor: '#0d9488', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryActionText: { color: '#0d9488', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  treatmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  treatmentCondition: { fontSize: 13, color: '#374151' },
  treatmentBadge: { backgroundColor: '#ccfbf1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  treatmentBadgeText: { color: '#0d9488', fontSize: 11, fontWeight: '600' },
});
