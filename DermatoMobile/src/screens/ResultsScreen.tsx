import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, TextInput, Dimensions, Share, LayoutAnimation } from 'react-native';
import Svg, { Rect, Polygon, Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Cpu,
  FlaskConical,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
  Home as HomeRemedyIcon,
  Pill,
  Stethoscope,
  ArrowUpCircle,
  Images,
  CalendarClock,
  StickyNote,
  Share2,
} from 'lucide-react-native';
import {
  absoluteUrl,
  getPatientSessions,
  getTreatmentPlans,
  updatePatientNote,
  AnalyzeResult,
  SessionOut,
  TreatmentPlanOut,
} from '../api/client';
import { computeSkinScoreFromSeverities, computeSkinScoreFromSession, scoreMeta } from '../utils/skinScore';
import { CONDITION_LABELS, SEVERITY_META, COLORS } from '../constants';
import BeforeAfterPhotoToggle from '../components/BeforeAfterPhotoToggle';

type RootStackParamList = { MainTabs: { screen: string } | undefined; Results: { result: AnalyzeResult; selected: string[] } };

const OVERLAY_META: Record<string, { label: string; color: string }> = {
  acne: { label: 'Acne', color: '#ef4444' },
  pigmentation: { label: 'Pigmentation', color: '#a855f7' },
  wrinkle: { label: 'Wrinkles', color: '#0ea5e9' },
};

const DETECTION_CATEGORY: Record<string, string> = {
  blackheads: 'acne', nodules: 'acne', papules: 'acne', pustules: 'acne', whiteheads: 'acne',
  'dark spot': 'pigmentation',
  Acne: 'acne', Blackheads: 'acne', Whiteheads: 'acne',
  'Dark-Spots': 'pigmentation',
  Wrinkles: 'wrinkle',
  'Enlarged-Pores': 'pore',
  'Dry-Skin': 'other', Eyebags: 'other', 'Oily-Skin': 'other', 'Skin-Redness': 'other',
};

const CATEGORY_COLOR: Record<string, string> = {
  acne: '#ef4444', pigmentation: '#a855f7', wrinkle: '#0ea5e9', pore: '#d97706', other: '#9ca3af',
};

const REC_TYPE_ICON: Record<string, typeof Pill> = {
  'Home remedy': HomeRemedyIcon,
  'OTC Cosmeceutical': Pill,
  Referral: Stethoscope,
};

const SEVERITY_NUM: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };

const DELTA_META: Record<string, { color: string; icon: typeof ArrowUpRight; label: string }> = {
  improved: { color: '#059669', icon: ArrowDownRight, label: 'improved' },
  same: { color: '#9ca3af', icon: Minus, label: 'unchanged' },
  worsened: { color: '#dc2626', icon: ArrowUpRight, label: 'worsened' },
};

// Hand-rolled radar/spider chart — no charting lib on mobile, but
// react-native-svg (added for icons) gives us the primitives to draw one
// directly: N axes at even angles, concentric grid rings, and a filled
// polygon for the data itself.
function RadarChart({ data, size = 240 }: { data: { subject: string; value: number }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;
  const n = data.length;
  if (n < 3) return null;

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, fraction: number) => {
    const angle = angleFor(i);
    return [cx + Math.cos(angle) * r * fraction, cy + Math.sin(angle) * r * fraction];
  };

  const gridRings = [0.33, 0.66, 1];
  const dataPoints = data.map((d, i) => pointAt(i, Math.min(d.value, 3) / 3));
  const dataPolygon = dataPoints.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {gridRings.map((fraction) => {
          const ringPoints = data.map((_, i) => pointAt(i, fraction).join(',')).join(' ');
          return <Polygon key={fraction} points={ringPoints} fill="none" stroke="#e5e7eb" strokeWidth={1} />;
        })}
        {data.map((_, i) => {
          const [x, y] = pointAt(i, 1);
          return <SvgLine key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
        })}
        <Polygon points={dataPolygon} fill="#0d9488" fillOpacity={0.35} stroke="#0d9488" strokeWidth={2} />
        {dataPoints.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={3} fill="#0d9488" />
        ))}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {data.map((d, i) => {
          const [lx, ly] = pointAt(i, 1.22);
          return (
            <Text
              key={d.subject}
              style={[
                styles.radarLabel,
                { left: lx - 36, top: ly - 8, width: 72, textAlign: 'center' },
              ]}
            >
              {d.subject}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

// Same nudge as the web app's ResultsPage: surfaces the recheck date(s)
// treatment_tracker.py already computed for the plan(s) this exact analysis
// just created, right here at the moment of highest attention.
function RecheckReminder({ plans, sessionId, conditionsShown }: { plans: TreatmentPlanOut[]; sessionId: number; conditionsShown: string[] }) {
  const justCreated = plans.filter(
    (p) => p.started_session_id === sessionId && p.expected_recheck_at && conditionsShown.includes(p.condition)
  );
  if (justCreated.length === 0) return null;

  const firstDate = new Date(justCreated[0].expected_recheck_at as string).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={[styles.alertBanner, styles.alertInfo]}>
      <CalendarClock size={18} color="#0f766e" style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertText, styles.alertTextInfo]}>
          We'll check back with you around {firstDate} to see how things are progressing.
        </Text>
        {justCreated.length > 1 && (
          <Text style={styles.alertFootnote}>
            Rechecks scheduled:{' '}
            {justCreated
              .map(
                (p) =>
                  `${p.condition} on ${new Date(p.expected_recheck_at as string).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}`
              )
              .join(', ')}
            .
          </Text>
        )}
      </View>
    </View>
  );
}

function PatientNoteCard({ sessionId }: { sessionId: number }) {
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePatientNote(sessionId, note);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing && !note) {
    return (
      <View style={styles.card}>
        <View style={styles.noteHeaderRow}>
          <View style={styles.cardTitleRow}>
            <StickyNote size={16} color="#0d9488" />
            <Text style={styles.cardTitle}>My Notes</Text>
          </View>
          <TouchableOpacity onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Add a note">
            <Text style={styles.noteAction}>Add a note</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <StickyNote size={16} color="#0d9488" />
        <Text style={styles.cardTitle}>My Notes</Text>
      </View>
      {editing ? (
        <View style={{ width: '100%', marginTop: 10 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            placeholder="e.g. Started a new moisturizer today"
            style={styles.noteInput}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={saving ? 'Saving note' : 'Save note'}
            >
              <Text style={styles.noteSave}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditing(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing note"
            >
              <Text style={styles.noteCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noteHeaderRow}>
          <Text style={styles.noteText}>{note}</Text>
          <TouchableOpacity onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit note">
            <Text style={styles.noteAction}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { result, selected } = route.params;
  const {
    severity, recommendations, model_powered: modelPowered, ml_detections: mlDetections,
    previous_severity: previousSeverity = {}, flags = {}, wsi = {}, overlays = {}, image_url: imageUrl, patient_id: patientId,
  } = result;
  const detections = mlDetections?.detections ?? [];

  const [showDetails, setShowDetails] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [plans, setPlans] = useState<TreatmentPlanOut[]>([]);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPatientSessions(patientId)
        .then((r) => setSessions(r.data))
        .catch((err) => console.warn('Failed to load sessions/plans for results extras:', err));
      getTreatmentPlans(patientId)
        .then((r) => setPlans(r.data))
        .catch((err) => console.warn('Failed to load sessions/plans for results extras:', err));
    }, [patientId])
  );

  useEffect(() => {
    if (!imageUrl) return;
    Image.getSize(
      absoluteUrl(imageUrl),
      (width, height) => setImageSize({ width, height }),
      () => {}
    );
  }, [imageUrl]);

  // The just-completed session is already the last entry; the one before it
  // is this scan's "before" — same logic as the web app's ResultsPage.
  const previousSession = sessions.length >= 2 ? sessions[sessions.length - 2] : null;

  const severityToShow = useMemo(
    () => Object.fromEntries(Object.entries(severity).filter(([k]) => selected.includes(k))),
    [severity, selected]
  );
  const recommendationsToShow = useMemo(
    () => Object.entries(recommendations).filter(([k]) => k !== 'disclaimer' && selected.includes(k)),
    [recommendations, selected]
  );
  const hasReferral = recommendationsToShow.some(([, rec]) => (rec as any).type === 'Referral');
  const hasSevere = Object.values(severityToShow).some((v) => v === 'severe');
  const needsAttention = hasReferral || hasSevere;

  const overlayChoices = Object.keys(OVERLAY_META).filter(
    (k) => ((overlays as any)[k]?.length ?? 0) > 0 && selected.includes(k)
  );

  const radarData = Object.entries(severityToShow).map(([condition, level]) => ({
    subject: CONDITION_LABELS[condition] ?? condition,
    value: SEVERITY_NUM[level as string] ?? 0,
  }));

  const skinScore = computeSkinScoreFromSeverities(severity);
  const previousScore = computeSkinScoreFromSeverities(previousSeverity);
  const scoreInfo = scoreMeta(skinScore);
  const scoreDelta = previousScore != null && skinScore != null ? skinScore - previousScore : null;

  const screenWidth = Dimensions.get('window').width - 40;
  const renderedImageHeight = imageSize ? (screenWidth * imageSize.height) / imageSize.width : 260;

  const detectionCategoriesShown = [...new Set(detections.map((d) => DETECTION_CATEGORY[d.label] ?? 'other'))];

  const toggleOverlay = (key: string) => {
    setActiveOverlays((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Analysis Results</Text>
        <View style={styles.modelBadge}>
          {modelPowered ? <Cpu size={12} color="#0d9488" /> : <FlaskConical size={12} color="#0d9488" />}
          <Text style={styles.modelBadgeText}>{modelPowered ? 'AI model-powered' : 'Classical CV'}</Text>
        </View>
      </View>

      <View style={[styles.alertBanner, needsAttention ? styles.alertWarning : styles.alertInfo]}>
        <AlertTriangle size={18} color={needsAttention ? '#92400e' : '#0f766e'} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertText, needsAttention ? styles.alertTextWarning : styles.alertTextInfo]}>
            {needsAttention
              ? 'One or more areas are worth a professional look — see the recommendation below.'
              : 'Your results look manageable — see your personalized recommendations below.'}
          </Text>
          <Text style={styles.alertFootnote}>
            This is not a diagnosis and does not replace a clinical visit. See a doctor promptly if any area is
            bleeding, rapidly changing, or not healing — regardless of this result.
          </Text>
        </View>
      </View>

      <RecheckReminder plans={plans} sessionId={result.session_id} conditionsShown={Object.keys(severityToShow)} />

      {skinScore != null && (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>SKIN HEALTH SCORE</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroScore}>{skinScore}</Text>
            <Text style={styles.heroOutOf}>/ 100</Text>
          </View>
          <View style={styles.heroFooterRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{scoreInfo.label}</Text>
            </View>
            {scoreDelta != null && scoreDelta !== 0 && (
              <Text style={[styles.heroDelta, { color: scoreDelta > 0 ? '#86efac' : '#fca5a5' }]}>
                {scoreDelta > 0 ? '↑' : '↓'} {scoreDelta > 0 ? '+' : ''}
                {scoreDelta} vs. last visit
              </Text>
            )}
          </View>
        </View>
      )}

      {imageUrl && (
        <View style={styles.card}>
          <View style={[styles.photoWrap, { height: renderedImageHeight }]}>
            <Image
              source={{ uri: absoluteUrl(imageUrl) }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              accessibilityLabel="Analyzed photo with detected features"
            />
            {detections.map((d, i) => {
              const cat = DETECTION_CATEGORY[d.label] ?? 'other';
              const color = CATEGORY_COLOR[cat];
              const [x0, y0, x1, y1] = d.box;
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${x0 * 100}%`,
                    top: `${y0 * 100}%`,
                    width: `${(x1 - x0) * 100}%`,
                    height: `${(y1 - y0) * 100}%`,
                    borderWidth: 2,
                    borderColor: color,
                    borderRadius: 2,
                  }}
                >
                  <View style={[styles.detectionChip, { backgroundColor: color }]}>
                    <Text style={styles.detectionChipText}>{d.label}</Text>
                  </View>
                </View>
              );
            })}
            {activeOverlays.length > 0 && (
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                {activeOverlays.includes('acne') &&
                  (overlays.acne ?? []).map((r, i) => (
                    <Rect
                      key={`a${i}`}
                      x={r.box[0] * 100}
                      y={r.box[1] * 100}
                      width={(r.box[2] - r.box[0]) * 100}
                      height={(r.box[3] - r.box[1]) * 100}
                      fill="none"
                      stroke={OVERLAY_META.acne.color}
                      strokeWidth={0.5}
                    />
                  ))}
                {activeOverlays.includes('pigmentation') &&
                  (overlays.pigmentation ?? []).map((r, i) => (
                    <Polygon
                      key={`p${i}`}
                      points={r.polygon.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                      fill={OVERLAY_META.pigmentation.color}
                      fillOpacity={0.18}
                      stroke={OVERLAY_META.pigmentation.color}
                      strokeWidth={0.5}
                    />
                  ))}
                {activeOverlays.includes('wrinkle') &&
                  (overlays.wrinkle ?? []).map((r, i) => (
                    <Polyline
                      key={`w${i}`}
                      points={r.line.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                      fill="none"
                      stroke={OVERLAY_META.wrinkle.color}
                      strokeWidth={0.5}
                    />
                  ))}
              </Svg>
            )}
          </View>

          {overlayChoices.length > 0 && (
            <View style={styles.overlayChipsRow}>
              <Text style={styles.overlayChipsLabel}>Show measured regions:</Text>
              {overlayChoices.map((k) => {
                const active = activeOverlays.includes(k);
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => toggleOverlay(k)}
                    style={[
                      styles.overlayChip,
                      active ? { backgroundColor: OVERLAY_META[k].color, borderColor: OVERLAY_META[k].color } : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={OVERLAY_META[k].label}
                  >
                    <View style={[styles.overlayChipDot, { backgroundColor: active ? '#fff' : OVERLAY_META[k].color }]} />
                    <Text style={[styles.overlayChipText, active && { color: '#fff' }]}>
                      {OVERLAY_META[k].label} ({(overlays as any)[k].length})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {detections.length > 0 && (
            <>
              <Text style={styles.detectionCount}>
                {detections.length} feature{detections.length === 1 ? '' : 's'} detected by AI
              </Text>
              <View style={styles.legendRow}>
                {detectionCategoriesShown.map((cat) => (
                  <View key={cat} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLOR[cat] }]} />
                    <Text style={styles.legendText}>{CONDITION_LABELS[cat] ?? cat}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {previousSession && imageUrl && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Images size={18} color="#0d9488" />
            <Text style={styles.cardTitle}>Before &amp; After</Text>
          </View>
          <Text style={styles.cardSubtitle}>Tap the photo to compare your previous visit and today</Text>
          <BeforeAfterPhotoToggle
            beforeUri={absoluteUrl(previousSession.image_url)}
            afterUri={absoluteUrl(imageUrl)}
            beforeLabel="Previous visit"
            afterLabel="Today"
            imageStyle={styles.compareImage}
          />
        </View>
      )}

      <View style={styles.grid}>
        {Object.entries(severityToShow).map(([condition, level]) => {
          const meta = SEVERITY_META[level as string] ?? SEVERITY_META.mild;
          const prev = previousSeverity[condition];
          const delta = prev
            ? DELTA_META[
                SEVERITY_NUM[level as string] < SEVERITY_NUM[prev]
                  ? 'improved'
                  : SEVERITY_NUM[level as string] > SEVERITY_NUM[prev]
                  ? 'worsened'
                  : 'same'
              ]
            : null;
          const wsiVal = (wsi as any)[condition];
          const flag = (flags as any)[condition];
          return (
            <View key={condition} style={styles.severityCard}>
              <Text style={styles.cardLabel}>{CONDITION_LABELS[condition] ?? condition}</Text>
              <View style={[styles.severityPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.severityPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              {wsiVal != null && <Text style={styles.wsi}>WSI {wsiVal.toFixed(2)}</Text>}
              {delta && (
                <View style={styles.deltaRow}>
                  <delta.icon size={12} color={delta.color} />
                  <Text style={[styles.deltaText, { color: delta.color }]}>{delta.label}</Text>
                </View>
              )}
              {flag && <Text style={styles.flag}>{flag}</Text>}
            </View>
          );
        })}
      </View>

      {radarData.length >= 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Severity Overview</Text>
          <RadarChart data={radarData} />
        </View>
      )}

      {mlDetections && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => {
              LayoutAnimation.easeInEaseOut();
              setShowDetails((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            accessibilityLabel={showDetails ? 'Hide detected features' : 'Show detected features'}
          >
            <Text style={styles.cardTitle}>Detected Features</Text>
            {showDetails ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
          </TouchableOpacity>
          {showDetails && (
            <View style={{ marginTop: 10 }}>
              {mlDetections.acne_lesion_types && Object.keys(mlDetections.acne_lesion_types).length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.subLabel}>Acne lesion types</Text>
                  <View style={styles.badgeRow}>
                    {Object.entries(mlDetections.acne_lesion_types).map(([type, count]) => (
                      <View key={type} style={styles.brandBadge}>
                        <Text style={styles.brandBadgeText}>{type}: {count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {mlDetections.skin_problem_counts && (
                <View>
                  <Text style={styles.subLabel}>Skin feature counts</Text>
                  <View style={styles.badgeRow}>
                    {Object.entries(mlDetections.skin_problem_counts)
                      .filter(([, count]) => (count as number) > 0)
                      .map(([feature, count]) => (
                        <View key={feature} style={styles.grayBadge}>
                          <Text style={styles.grayBadgeText}>{feature.replace(/-/g, ' ')}: {count}</Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Recommendations</Text>
      {recommendationsToShow.map(([condition, rec]: [string, any]) => {
        const RecIcon = REC_TYPE_ICON[rec.type] ?? Pill;
        return (
          <View key={condition} style={styles.recCard}>
            <View style={styles.recHeaderRow}>
              <Text style={styles.recCondition}>{CONDITION_LABELS[condition] ?? condition}</Text>
              <View style={styles.recBadgeRow}>
                {rec.escalated && (
                  <View style={styles.escalatedBadge}>
                    <ArrowUpCircle size={11} color="#d97706" />
                    <Text style={styles.escalatedBadgeText}>Escalated</Text>
                  </View>
                )}
                <View style={styles.grayBadge}>
                  <RecIcon size={11} color="#4b5563" />
                  <Text style={styles.grayBadgeText}>{rec.type}</Text>
                </View>
              </View>
            </View>
            {rec.escalated && (
              <Text style={styles.escalated}>Previous remedies haven't helped, so this was bumped up a tier.</Text>
            )}
            {rec.examples?.map((ex: string) => (
              <Text key={ex} style={styles.recExample}>• {ex}</Text>
            ))}
            {rec.duration_weeks ? <Text style={styles.duration}>Duration: {rec.duration_weeks} weeks</Text> : null}
          </View>
        );
      })}

      <PatientNoteCard sessionId={result.session_id} />

      <Text style={styles.disclaimer}>{(recommendations as any).disclaimer}</Text>

      <View style={styles.ctaRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Analyze' })}
          accessibilityRole="button"
          accessibilityLabel="New Analysis"
        >
          <Text style={styles.buttonText}>New Analysis</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Progress' })}
          accessibilityRole="button"
          accessibilityLabel="View Progress"
        >
          <Text style={styles.secondaryButtonText}>View Progress</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={() => {
          const lines = Object.entries(severityToShow).map(([condition, level]) => `${condition}: ${level}`);
          const message = `My Dermato skin analysis${skinScore != null ? ` — Skin Health Score ${skinScore}/100` : ''}\n${lines.join(', ')}`;
          Share.share({ message }).catch(() => {});
        }}
        accessibilityRole="button"
        accessibilityLabel="Share Result"
      >
        <Share2 size={15} color="#0d9488" />
        <Text style={styles.shareButtonText}>Share Result</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading },
  modelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ccfbf1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  modelBadgeText: { fontSize: 11, color: COLORS.teal, fontWeight: '600' },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 14, marginBottom: 16 },
  alertWarning: { backgroundColor: '#fffbeb' },
  alertInfo: { backgroundColor: '#f0fdfa' },
  alertText: { fontSize: 13, fontWeight: '500' },
  alertTextWarning: { color: '#92400e' },
  alertTextInfo: { color: '#0f766e' },
  alertFootnote: { fontSize: 11, color: COLORS.mutedGray, marginTop: 4, lineHeight: 15 },
  hero: { backgroundColor: '#0f766e', borderRadius: 16, padding: 20, marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  heroScore: { color: '#fff', fontSize: 44, fontWeight: '700' },
  heroOutOf: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginLeft: 6 },
  heroFooterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroDelta: { fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.heading },
  cardSubtitle: { fontSize: 11, color: COLORS.mutedGray, marginBottom: 12, alignSelf: 'flex-start' },
  photoWrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.divider },
  detectionChip: { position: 'absolute', top: -18, left: 0, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  detectionChipText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  overlayChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  overlayChipsLabel: { fontSize: 11, color: COLORS.mutedGray },
  overlayChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.divider, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  overlayChipDot: { width: 7, height: 7, borderRadius: 4 },
  overlayChipText: { fontSize: 11, fontWeight: '600', color: '#4b5563' },
  detectionCount: { fontSize: 11, color: COLORS.mutedGray, marginTop: 10 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.secondaryText },
  compareImage: { width: '100%', height: 260, borderRadius: 12, backgroundColor: COLORS.divider },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  severityCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  cardLabel: { fontSize: 12, color: COLORS.secondaryText, marginBottom: 6 },
  severityPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  severityPillText: { fontSize: 12, fontWeight: '700' },
  wsi: { fontSize: 11, color: COLORS.mutedGray },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  deltaText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  flag: { fontSize: 11, color: '#d97706', marginTop: 4 },
  radarLabel: { position: 'absolute', fontSize: 11, color: '#4b5563', fontWeight: '600' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  subLabel: { fontSize: 12, fontWeight: '600', color: COLORS.secondaryText, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  brandBadge: { backgroundColor: '#ccfbf1', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  brandBadgeText: { fontSize: 11, color: COLORS.teal, fontWeight: '600' },
  grayBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  grayBadgeText: { fontSize: 11, color: '#4b5563', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.heading, marginTop: 4, marginBottom: 10 },
  recCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  recHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 },
  recCondition: { fontWeight: '600', color: COLORS.heading },
  recBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  escalatedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  escalatedBadgeText: { fontSize: 11, color: '#d97706', fontWeight: '600' },
  escalated: { fontSize: 11, color: '#d97706', marginBottom: 4 },
  recExample: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  duration: { fontSize: 11, color: COLORS.mutedGray, marginTop: 6 },
  disclaimer: { fontSize: 11, color: COLORS.mutedGray, fontStyle: 'italic', marginTop: 12, marginBottom: 20 },
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  button: { flex: 1, backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: COLORS.teal, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: COLORS.teal, fontWeight: '700', fontSize: 15 },
  noteHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' },
  noteAction: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  noteInput: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 10, padding: 10, fontSize: 13, color: COLORS.heading, textAlignVertical: 'top', minHeight: 70 },
  noteSave: { fontSize: 13, fontWeight: '700', color: COLORS.teal },
  noteCancel: { fontSize: 13, fontWeight: '600', color: COLORS.mutedGray },
  noteText: { flex: 1, fontSize: 13, color: '#4b5563', marginTop: 8 },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.divider, borderRadius: 10, paddingVertical: 12, marginBottom: 30 },
  shareButtonText: { color: COLORS.teal, fontWeight: '600', fontSize: 13 },
});
