import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getPatientSessions, getTreatmentPlans, SessionOut, TreatmentPlanOut } from '../api/client';
import { CONDITION_LABELS } from '../constants';

const TRACK_HEIGHT = 90;
const DOT_COL_WIDTH = 44;

// WSI -> band color, matching the same </=0.33/0.66 thresholds the backend's
// severity_classifier.py uses to decide mild/moderate/severe.
function wsiColor(wsi: number): string {
  if (wsi > 0.66) return '#dc2626';
  if (wsi >= 0.33) return '#d97706';
  return '#059669';
}

// No react-native-svg in this project (avoids a native-module rebuild) — this
// renders the same mild/moderate/severe trend the web app's LineChart shows,
// as a track of positioned dots instead of a drawn line. WSI=0 (mild) sits at
// the bottom, WSI=1 (severe) at the top, same orientation as the web chart.
function TrendTrack({ label, values }: { label: string; values: (number | null)[] }) {
  const hasData = values.some((v) => v != null);
  if (!hasData) return null;
  return (
    <View style={styles.trendBlock}>
      <Text style={styles.trendLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.band, styles.bandSevere]} />
        <View style={[styles.band, styles.bandModerate]} />
        <View style={[styles.band, styles.bandMild]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}>
          {values.map((wsi, i) => (
            <View key={i} style={styles.dotCol}>
              {wsi != null && (
                <View style={[styles.dot, { top: (1 - wsi) * (TRACK_HEIGHT - 10), backgroundColor: wsiColor(wsi) }]} />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.trendFooterRow}>
        <Text style={styles.trendFooterText}>Mild</Text>
        <Text style={styles.trendFooterText}>Severe ↑</Text>
      </View>
    </View>
  );
}

const OUTCOME_META: Record<string, { color: string; label: string }> = {
  improved: { color: '#059669', label: 'Improved' },
  unchanged: { color: '#6b7280', label: 'Unchanged' },
  worsened: { color: '#dc2626', label: 'Worsened' },
};

export default function ProgressScreen() {
  const { patientId } = useAuth();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getPatientSessions(patientId), getTreatmentPlans(patientId)]);
      setSessions(s.data);
      setPlans([...p.data].reverse());
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
    >
      <Text style={styles.title}>Progress</Text>

      {sessions.length === 0 ? (
        <Text style={styles.emptyText}>No sessions recorded yet — run an analysis to start tracking.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Severity Over Time</Text>
          <Text style={styles.cardSubtitle}>Weighted Severity Index per visit — lower is better</Text>
          <TrendTrack label={CONDITION_LABELS.acne} values={sessions.map((s) => s.acne_wsi ?? null)} />
          <TrendTrack label={CONDITION_LABELS.pigmentation} values={sessions.map((s) => s.pigmentation_wsi ?? null)} />
          <TrendTrack label={CONDITION_LABELS.wrinkle} values={sessions.map((s) => s.wrinkle_wsi ?? null)} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Treatment Plans</Text>
        {plans.length === 0 ? (
          <Text style={styles.emptyText}>No treatment plans yet.</Text>
        ) : (
          plans.map((p) => (
            <View key={p.id} style={styles.planRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planCondition}>{CONDITION_LABELS[p.condition] || p.condition}</Text>
                <Text style={styles.planRemedy}>{p.remedy_type} · started {new Date(p.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
              </View>
              {p.status === 'active' ? (
                <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>
              ) : p.outcome ? (
                <View style={[styles.outcomeBadge, { backgroundColor: `${OUTCOME_META[p.outcome].color}20` }]}>
                  <Text style={[styles.outcomeBadgeText, { color: OUTCOME_META[p.outcome].color }]}>{OUTCOME_META[p.outcome].label}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSubtitle: { fontSize: 11, color: '#9ca3af', marginBottom: 12 },
  trendBlock: { marginTop: 14 },
  trendLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  track: { height: TRACK_HEIGHT, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  band: { position: 'absolute', left: 0, right: 0 },
  bandSevere: { top: 0, height: TRACK_HEIGHT / 3, backgroundColor: '#fee2e2' },
  bandModerate: { top: TRACK_HEIGHT / 3, height: TRACK_HEIGHT / 3, backgroundColor: '#fef3c7' },
  bandMild: { top: (TRACK_HEIGHT / 3) * 2, height: TRACK_HEIGHT / 3, backgroundColor: '#d1fae5' },
  dotCol: { width: DOT_COL_WIDTH, height: TRACK_HEIGHT, alignItems: 'center' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  trendFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  trendFooterText: { fontSize: 9, color: '#9ca3af' },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  planCondition: { fontSize: 13, fontWeight: '600', color: '#374151' },
  planRemedy: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  activeBadge: { backgroundColor: '#ccfbf1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { color: '#0d9488', fontSize: 11, fontWeight: '600' },
  outcomeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  outcomeBadgeText: { fontSize: 11, fontWeight: '600' },
});
