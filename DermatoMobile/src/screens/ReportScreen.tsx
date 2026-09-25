import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowUpCircle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react-native';
import { absoluteUrl, getSession, getTreatmentPlans, SessionOut, TreatmentPlanOut } from '../api/client';
import { CONDITION_LABELS, SEVERITY_META, COLORS } from '../constants';
import ErrorState from '../components/ErrorState';

type RootStackParamList = { Report: { sessionId: number } };

const OUTCOME_META: Record<string, { color: string; icon: any; label: string }> = {
  improved: { color: '#059669', icon: ArrowDownRight, label: 'Improved' },
  unchanged: { color: '#6b7280', icon: Minus, label: 'Unchanged' },
  worsened: { color: '#dc2626', icon: ArrowUpRight, label: 'Worsened' },
};

const CONDITIONS = Object.keys(CONDITION_LABELS);

export default function ReportScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Report'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sessionId } = route.params;

  const [session, setSession] = useState<SessionOut | null>(null);
  const [plans, setPlans] = useState<TreatmentPlanOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSession(sessionId);
      setSession(data);
      setError('');
      try {
        const { data: planData } = await getTreatmentPlans(data.patient_id);
        setPlans(planData);
      } catch {
        setPlans([]);
      }
    } catch {
      setError("Couldn't load this report.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={COLORS.teal} />
      </View>
    );
  }

  if (error || !session) {
    return <ErrorState message={error || "Couldn't load this report."} onRetry={load} />;
  }

  const conditions = CONDITIONS.filter((c) => (session as any)[`${c}_severity`]);
  const recommendations = session.recommendations || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backLink}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Skin Analysis Report</Text>
      <Text style={styles.subtitle}>Captured {new Date(session.captured_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>

      <Image source={{ uri: absoluteUrl(session.image_url) }} style={styles.image} />

      <Text style={styles.sectionTitle}>Severity Summary</Text>
      <View style={styles.severityGrid}>
        {conditions.map((c) => {
          const level = (session as any)[`${c}_severity`] as string;
          const meta = SEVERITY_META[level] ?? SEVERITY_META.mild;
          return (
            <View key={c} style={styles.severityCard}>
              <Text style={styles.severityCardLabel}>{CONDITION_LABELS[c]}</Text>
              <View style={[styles.severityPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.severityPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {conditions.some((c) => recommendations[c]) && (
        <>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {conditions.map((c) => {
            const rec = recommendations[c];
            if (!rec) return null;
            return (
              <View key={c} style={styles.recCard}>
                <View style={styles.recHeaderRow}>
                  <Text style={styles.recCondition}>{CONDITION_LABELS[c]} — {rec.type}</Text>
                  {rec.escalated && (
                    <View style={styles.escalatedBadge}>
                      <ArrowUpCircle size={11} color="#d97706" />
                      <Text style={styles.escalatedBadgeText}>Escalated</Text>
                    </View>
                  )}
                </View>
                {rec.examples?.length > 0 && <Text style={styles.recExamples}>{rec.examples.join(', ')}</Text>}
                {rec.how_to ? <Text style={styles.howTo}>{rec.how_to}</Text> : null}
                {rec.duration_weeks ? <Text style={styles.duration}>Duration: {rec.duration_weeks} weeks</Text> : null}
              </View>
            );
          })}
        </>
      )}

      {plans.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Treatment History</Text>
          <View style={styles.card}>
            {[...plans].reverse().map((p) => {
              const outcomeMeta = p.outcome ? OUTCOME_META[p.outcome] : null;
              return (
                <View key={p.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyText}>
                      <Text style={{ fontWeight: '700' }}>{CONDITION_LABELS[p.condition] ?? p.condition}</Text> — {p.remedy_type} from{' '}
                      {new Date(p.started_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {p.status === 'active' ? (
                    <View style={[styles.statusBadge, { backgroundColor: COLORS.tealSoft }]}>
                      <Text style={[styles.statusBadgeText, { color: COLORS.teal }]}>Active</Text>
                    </View>
                  ) : outcomeMeta ? (
                    <View style={[styles.statusBadge, { backgroundColor: `${outcomeMeta.color}20` }]}>
                      <outcomeMeta.icon size={11} color={outcomeMeta.color} />
                      <Text style={[styles.statusBadgeText, { color: outcomeMeta.color }]}>{outcomeMeta.label}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      )}

      {session.doctor_note && (
        <>
          <Text style={styles.sectionTitle}>Doctor's Note</Text>
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{session.doctor_note}</Text>
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Analyzed with the Dermato Weighted Severity Index (WSI){session.model_powered ? ' + AI detection models' : ' — classical computer vision'}
        </Text>
        <Text style={styles.footerDisclaimer}>
          {recommendations.disclaimer || 'For informational use only. Please consult a dermatologist for medical advice.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  backLink: { fontSize: 14, fontWeight: '600', color: COLORS.teal, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading },
  subtitle: { fontSize: 13, color: COLORS.secondaryText, marginTop: 4, marginBottom: 16 },
  image: { width: '100%', height: 260, borderRadius: 14, backgroundColor: COLORS.divider, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.heading, marginBottom: 10, marginTop: 4 },
  severityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  severityCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    alignItems: 'center',
  },
  severityCardLabel: { fontSize: 12, color: COLORS.secondaryText, marginBottom: 6 },
  severityPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  severityPillText: { fontSize: 12, fontWeight: '700' },
  recCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  recHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  recCondition: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.heading },
  escalatedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  escalatedBadgeText: { fontSize: 11, color: '#d97706', fontWeight: '600' },
  recExamples: { fontSize: 12, color: '#4b5563', marginTop: 2 },
  howTo: { fontSize: 12, color: COLORS.mutedGray, marginTop: 6, lineHeight: 17 },
  duration: { fontSize: 11, color: COLORS.mutedGray, marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6 },
  historyText: { fontSize: 12, color: '#4b5563', lineHeight: 17 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  noteBox: { backgroundColor: COLORS.tealSoft, borderRadius: 12, padding: 12, marginBottom: 20 },
  noteText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  footer: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14, marginBottom: 30, gap: 4 },
  footerText: { fontSize: 11, fontWeight: '600', color: COLORS.mutedGray },
  footerDisclaimer: { fontSize: 11, color: COLORS.mutedGray, fontStyle: 'italic' },
});
