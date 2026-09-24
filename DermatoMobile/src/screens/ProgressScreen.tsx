import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TextInput, TouchableOpacity, LayoutAnimation } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, TrendingUp, ClipboardList } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  getPatientSessions,
  getTreatmentPlans,
  getPatient,
  updateSkinHistory,
  updateTreatmentAdherence,
  absoluteUrl,
  SessionOut,
  TreatmentPlanOut,
  SkinHistory,
} from '../api/client';
import { CONDITION_LABELS, SEVERITY_META, COLORS } from '../constants';
import { computeTreatmentProgress } from '../utils/treatmentProgress';
import ErrorState from '../components/ErrorState';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import EmptyState from '../components/EmptyState';

type RootStackParamList = { Messages: undefined };

const SKIN_HISTORY_FIELDS: [keyof SkinHistory, string][] = [
  ['allergies', 'Allergies'],
  ['current_products', 'Current products'],
  ['known_conditions', 'Known conditions'],
  ['medications', 'Medications'],
];

function SkinHistoryCard({ patientId, history, onSaved }: { patientId: number; history: SkinHistory | null | undefined; onSaved: (h: SkinHistory) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SkinHistory>({
    allergies: history?.allergies || '',
    current_products: history?.current_products || '',
    known_conditions: history?.known_conditions || '',
    medications: history?.medications || '',
  });

  const hasAny = SKIN_HISTORY_FIELDS.some(([key]) => history?.[key]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await updateSkinHistory(patientId, form);
      onSaved(data.skin_history || form);
      LayoutAnimation.easeInEaseOut();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Skin History</Text>
        {!editing && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.easeInEaseOut();
              setEditing(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit skin history"
          >
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <View>
          {SKIN_HISTORY_FIELDS.map(([key, label]) => (
            <View key={key} style={{ marginBottom: 10 }}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                value={form[key] || ''}
                onChangeText={(v) => setForm({ ...form, [key]: v })}
                style={styles.input}
                placeholder={`Add ${label.toLowerCase()}...`}
              />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={saving ? 'Saving skin history' : 'Save skin history'}
            >
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                LayoutAnimation.easeInEaseOut();
                setEditing(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing skin history"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : hasAny ? (
        SKIN_HISTORY_FIELDS.map(([key, label]) => (
          history?.[key] ? (
            <View key={key} style={styles.historyRow}>
              <Text style={styles.historyLabel}>{label}</Text>
              <Text style={styles.historyValue}>{history[key]}</Text>
            </View>
          ) : null
        ))
      ) : (
        <Text style={styles.emptyText}>No skin history recorded yet.</Text>
      )}
    </View>
  );
}

function BeforeAfterCard({ sessions }: { sessions: SessionOut[] }) {
  const [leftIdx, setLeftIdx] = useState<number | null>(null);
  const [rightIdx, setRightIdx] = useState<number | null>(null);
  const effectiveLeft = leftIdx ?? 0;
  const effectiveRight = rightIdx ?? sessions.length - 1;
  const left = sessions[effectiveLeft];
  const right = sessions[effectiveRight];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Before &amp; After</Text>
      <Text style={styles.cardSubtitle}>Drag the photo to compare any two visits</Text>

      <Text style={styles.compareChipsLabel}>Before</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compareChipsRow}>
        {sessions.map((s, i) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.compareChip, i === effectiveLeft && styles.compareChipActive]}
            onPress={() => setLeftIdx(i)}
            disabled={i === effectiveRight}
            accessibilityRole="button"
            accessibilityLabel={`Compare from ${new Date(s.captured_at).toLocaleDateString()}`}
          >
            <Text style={[styles.compareChipText, i === effectiveLeft && styles.compareChipTextActive]}>
              {new Date(s.captured_at).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.compareChipsLabel}>After</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compareChipsRow}>
        {sessions.map((s, i) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.compareChip, i === effectiveRight && styles.compareChipActive]}
            onPress={() => setRightIdx(i)}
            disabled={i === effectiveLeft}
            accessibilityRole="button"
            accessibilityLabel={`Compare to ${new Date(s.captured_at).toLocaleDateString()}`}
          >
            <Text style={[styles.compareChipText, i === effectiveRight && styles.compareChipTextActive]}>
              {new Date(s.captured_at).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BeforeAfterSlider
        beforeUri={absoluteUrl(left.image_url)}
        afterUri={absoluteUrl(right.image_url)}
        beforeLabel={new Date(left.captured_at).toLocaleDateString()}
        afterLabel={new Date(right.captured_at).toLocaleDateString()}
        imageStyle={styles.compareImage}
      />
    </View>
  );
}

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

const ADHERENCE_LABELS: Record<string, string> = {
  followed: 'You said: Followed it',
  partial: 'You said: Partially followed it',
  not_followed: "You said: Didn't follow it",
};

function AdherenceCheckIn({
  plan,
  patientId,
  onUpdated,
}: {
  plan: TreatmentPlanOut;
  patientId: number;
  onUpdated: (planId: number, adherence: 'followed' | 'partial' | 'not_followed') => void;
}) {
  const [saving, setSaving] = useState(false);

  if (plan.adherence) {
    return <Text style={styles.adherenceAnswer}>{ADHERENCE_LABELS[plan.adherence]}</Text>;
  }

  const answer = async (value: 'followed' | 'partial' | 'not_followed') => {
    setSaving(true);
    try {
      await updateTreatmentAdherence(patientId, plan.id, value);
      onUpdated(plan.id, value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.adherencePrompt}>
      <Text style={styles.adherenceLabel}>Did you follow this treatment?</Text>
      <View style={styles.adherenceRow}>
        <TouchableOpacity style={styles.adherenceChip} disabled={saving} onPress={() => answer('followed')}>
          <Text style={styles.adherenceChipText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adherenceChip} disabled={saving} onPress={() => answer('partial')}>
          <Text style={styles.adherenceChipText}>Partially</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adherenceChip} disabled={saving} onPress={() => answer('not_followed')}>
          <Text style={styles.adherenceChipText}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { patientId } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanOut[]>([]);
  const [skinHistory, setSkinHistory] = useState<SkinHistory | null | undefined>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [s, p, patient] = await Promise.all([
        getPatientSessions(patientId),
        getTreatmentPlans(patientId),
        getPatient(patientId),
      ]);
      setSessions(s.data);
      setPlans([...p.data].reverse());
      setSkinHistory(patient.data.skin_history);
      setError('');
    } catch {
      setError("Couldn't load your progress.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdherenceUpdated = (planId: number, adherence: 'followed' | 'partial' | 'not_followed') => {
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, adherence } : p)));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#0d9488" />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Progress</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Messages')}
          accessibilityRole="button"
          accessibilityLabel="Messages"
        >
          <Text style={styles.messagesLink}>Messages</Text>
        </TouchableOpacity>
      </View>

      {error && sessions.length === 0 && plans.length === 0 && !skinHistory ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {sessions.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No sessions yet" description="Run an analysis to start tracking your progress." />
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Severity Over Time</Text>
              <Text style={styles.cardSubtitle}>Weighted Severity Index per visit — lower is better</Text>
              <TrendTrack label={CONDITION_LABELS.acne} values={sessions.map((s) => s.acne_wsi ?? null)} />
              <TrendTrack label={CONDITION_LABELS.pigmentation} values={sessions.map((s) => s.pigmentation_wsi ?? null)} />
              <TrendTrack label={CONDITION_LABELS.wrinkle} values={sessions.map((s) => s.wrinkle_wsi ?? null)} />
            </View>
          )}

          {sessions.length >= 2 && <BeforeAfterCard sessions={sessions} />}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Treatment Plans</Text>
            {plans.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No treatment plans yet" />
            ) : (
              plans.map((p) => {
                const progress = computeTreatmentProgress(p);
                return (
                  <View key={p.id} style={styles.planRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planCondition}>{CONDITION_LABELS[p.condition] || p.condition}</Text>
                      <Text style={styles.planRemedy}>{p.remedy_type} · started {new Date(p.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                      {p.status === 'active' && p.expected_recheck_at && (
                        <Text style={styles.planRecheck}>
                          {new Date(p.expected_recheck_at) < new Date() ? 'Recheck overdue since ' : 'Recheck due '}
                          {new Date(p.expected_recheck_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                      {p.status === 'active' && patientId != null && (
                        <AdherenceCheckIn plan={p} patientId={patientId} onUpdated={handleAdherenceUpdated} />
                      )}
                      {p.status === 'resolved' && p.severity_at_start && p.outcome_severity && (
                        <View style={styles.transitionRow}>
                          <View style={[styles.severityPill, { backgroundColor: SEVERITY_META[p.severity_at_start].bg }]}>
                            <Text style={[styles.severityPillText, { color: SEVERITY_META[p.severity_at_start].color }]}>
                              {SEVERITY_META[p.severity_at_start].label}
                            </Text>
                          </View>
                          <ArrowRight size={12} color={COLORS.mutedGray} />
                          <View style={[styles.severityPill, { backgroundColor: SEVERITY_META[p.outcome_severity].bg }]}>
                            <Text style={[styles.severityPillText, { color: SEVERITY_META[p.outcome_severity].color }]}>
                              {SEVERITY_META[p.outcome_severity].label}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                    {p.status === 'active' ? (
                      <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>
                    ) : p.outcome ? (
                      <View style={[styles.outcomeBadge, { backgroundColor: `${OUTCOME_META[p.outcome].color}20` }]}>
                        <Text style={[styles.outcomeBadgeText, { color: OUTCOME_META[p.outcome].color }]}>{OUTCOME_META[p.outcome].label}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {patientId != null && (
            <SkinHistoryCard patientId={patientId} history={skinHistory} onSaved={setSkinHistory} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading, marginBottom: 16 },
  emptyText: { fontSize: 13, color: COLORS.mutedGray },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.heading },
  cardSubtitle: { fontSize: 11, color: COLORS.mutedGray, marginBottom: 12 },
  trendBlock: { marginTop: 14 },
  trendLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  track: { height: TRACK_HEIGHT, borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.border },
  band: { position: 'absolute', left: 0, right: 0 },
  bandSevere: { top: 0, height: TRACK_HEIGHT / 3, backgroundColor: '#fee2e2' },
  bandModerate: { top: TRACK_HEIGHT / 3, height: TRACK_HEIGHT / 3, backgroundColor: '#fef3c7' },
  bandMild: { top: (TRACK_HEIGHT / 3) * 2, height: TRACK_HEIGHT / 3, backgroundColor: '#d1fae5' },
  dotCol: { width: DOT_COL_WIDTH, height: TRACK_HEIGHT, alignItems: 'center' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  trendFooterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  trendFooterText: { fontSize: 9, color: COLORS.mutedGray },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  planCondition: { fontSize: 13, fontWeight: '600', color: '#374151' },
  planRemedy: { fontSize: 11, color: COLORS.mutedGray, marginTop: 1 },
  planRecheck: { fontSize: 11, color: '#d97706', marginTop: 2, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.teal },
  progressLabel: { fontSize: 10, color: COLORS.mutedGray, flexShrink: 0 },
  transitionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  severityPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  severityPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  activeBadge: { backgroundColor: '#ccfbf1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  activeBadgeText: { color: COLORS.teal, fontSize: 11, fontWeight: '600' },
  outcomeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  outcomeBadgeText: { fontSize: 11, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  messagesLink: { fontSize: 13, fontWeight: '600', color: COLORS.teal },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editLink: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  fieldLabel: { fontSize: 11, color: COLORS.secondaryText, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: COLORS.heading },
  saveButton: { backgroundColor: COLORS.teal, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cancelButton: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  cancelButtonText: { color: COLORS.secondaryText, fontWeight: '600', fontSize: 12 },
  historyRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  historyLabel: { fontSize: 10, color: COLORS.mutedGray },
  historyValue: { fontSize: 13, color: '#374151', marginTop: 1 },
  compareImage: { width: '100%', height: 260, borderRadius: 12, backgroundColor: COLORS.divider, marginTop: 10 },
  compareChipsLabel: { fontSize: 11, color: COLORS.mutedGray, marginTop: 10, marginBottom: 4 },
  compareChipsRow: { gap: 6 },
  compareChip: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  compareChipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  compareChipText: { fontSize: 11, color: COLORS.heading, fontWeight: '600' },
  compareChipTextActive: { color: '#fff' },
  adherencePrompt: { marginTop: 8, width: '100%' },
  adherenceLabel: { fontSize: 11, color: COLORS.mutedGray, marginBottom: 6 },
  adherenceRow: { flexDirection: 'row', gap: 6 },
  adherenceChip: { borderWidth: 1, borderColor: COLORS.teal, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  adherenceChipText: { color: COLORS.teal, fontWeight: '600', fontSize: 11 },
  adherenceAnswer: { fontSize: 11, color: COLORS.mutedGray, marginTop: 6, width: '100%' },
});
