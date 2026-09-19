import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { absoluteUrl } from '../api/client';

const SEVERITY_META: Record<string, { color: string; bg: string; label: string }> = {
  mild: { color: '#059669', bg: '#d1fae5', label: 'Mild' },
  moderate: { color: '#d97706', bg: '#fef3c7', label: 'Moderate' },
  severe: { color: '#dc2626', bg: '#fee2e2', label: 'Severe' },
};

const CONDITION_LABELS: Record<string, string> = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' };

type RootStackParamList = { Analyze: undefined; Results: { result: any; selected: string[] } };

export default function ResultsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { result, selected } = route.params;

  const severityToShow = Object.fromEntries(Object.entries(result.severity).filter(([k]) => selected.includes(k)));
  const recommendationsToShow = Object.entries(result.recommendations).filter(([k]) => k !== 'disclaimer' && selected.includes(k));
  const hasSevere = Object.values(severityToShow).some((v) => v === 'severe');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Analysis Results</Text>
        <Text style={styles.badge}>{result.model_powered ? 'AI model-powered' : 'Classical CV'}</Text>
      </View>

      <View style={[styles.banner, hasSevere ? styles.bannerAlert : styles.bannerOk]}>
        <Text style={[styles.bannerText, hasSevere && styles.bannerTextAlert]}>
          {hasSevere ? 'One or more areas are worth a professional look.' : 'Your results look manageable.'}
        </Text>
      </View>

      {result.image_url ? (
        <Image source={{ uri: absoluteUrl(result.image_url) }} style={styles.photo} />
      ) : null}

      <View style={styles.grid}>
        {Object.entries(severityToShow).map(([condition, level]) => {
          const meta = SEVERITY_META[level as string] ?? SEVERITY_META.mild;
          const wsi = result.wsi?.[condition];
          const flag = result.flags?.[condition];
          return (
            <View key={condition} style={styles.card}>
              <Text style={styles.cardLabel}>{CONDITION_LABELS[condition] ?? condition}</Text>
              <View style={[styles.severityPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.severityPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              {wsi != null && <Text style={styles.wsi}>WSI {wsi.toFixed(2)}</Text>}
              {flag && <Text style={styles.flag}>{flag}</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Recommendations</Text>
      {recommendationsToShow.map(([condition, rec]: [string, any]) => (
        <View key={condition} style={styles.recCard}>
          <View style={styles.recHeaderRow}>
            <Text style={styles.recCondition}>{CONDITION_LABELS[condition] ?? condition}</Text>
            <Text style={styles.recType}>{rec.type}</Text>
          </View>
          {rec.escalated && <Text style={styles.escalated}>Bumped up a tier — previous remedies haven't helped.</Text>}
          {rec.examples?.map((ex: string) => (
            <Text key={ex} style={styles.recExample}>• {ex}</Text>
          ))}
          {rec.duration_weeks ? <Text style={styles.duration}>Duration: {rec.duration_weeks} weeks</Text> : null}
        </View>
      ))}

      <Text style={styles.disclaimer}>{result.recommendations?.disclaimer}</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Analyze')}>
        <Text style={styles.buttonText}>New Analysis</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  badge: { fontSize: 11, color: '#0d9488', backgroundColor: '#ccfbf1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  banner: { borderRadius: 12, padding: 12, marginBottom: 16 },
  bannerOk: { backgroundColor: '#ecfdf5' },
  bannerAlert: { backgroundColor: '#fffbeb' },
  bannerText: { fontSize: 13, color: '#065f46' },
  bannerTextAlert: { color: '#92400e' },
  photo: { width: '100%', height: 240, borderRadius: 16, marginBottom: 16, resizeMode: 'cover', backgroundColor: '#e5e7eb' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  card: { flexBasis: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  cardLabel: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  severityPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  severityPillText: { fontSize: 12, fontWeight: '700' },
  wsi: { fontSize: 11, color: '#9ca3af' },
  flag: { fontSize: 11, color: '#d97706', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 10 },
  recCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  recHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recCondition: { fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  recType: { fontSize: 12, color: '#6b7280' },
  escalated: { fontSize: 11, color: '#d97706', marginBottom: 4 },
  recExample: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  duration: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  disclaimer: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 12, marginBottom: 20 },
  button: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
