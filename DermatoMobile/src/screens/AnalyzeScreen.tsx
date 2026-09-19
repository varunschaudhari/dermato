import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { analyzeImage, getErrorMessage } from '../api/client';
import { CONDITION_LABELS } from '../constants';

const CONDITIONS = ['acne', 'pigmentation', 'wrinkle', 'pore'] as const;

// Results lives in the root Stack (a sibling of MainTabs), not inside the tab
// navigator Analyze belongs to — navigate() still finds it by bubbling up to
// the parent navigator, this type just describes where it actually lives.
type RootStackParamList = { MainTabs: undefined; Results: { result: any; selected: string[] } };

export default function AnalyzeScreen() {
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [selected, setSelected] = useState<string[]>([...CONDITIONS]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { patientId, logout, fullName } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const toggleCondition = (c: string) => {
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const pickFrom = async (source: 'camera' | 'gallery') => {
    const result = source === 'camera' ? await launchCamera({ mediaType: 'photo', quality: 0.8 }) : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.[0]) setPhoto(result.assets[0]);
  };

  const handleAnalyze = async () => {
    if (!photo || !patientId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await analyzeImage(patientId, {
        uri: photo.uri!,
        type: photo.type || 'image/jpeg',
        name: photo.fileName || 'photo.jpg',
      });
      navigation.navigate('Results', { result: data, selected });
    } catch (err: any) {
      setError(getErrorMessage(err, 'Analysis failed. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Skin Analysis</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>{fullName ? `Hi ${fullName.split(' ')[0]} — ` : ''}Upload a clear, well-lit photo to get started</Text>

      <Text style={styles.label}>What would you like checked?</Text>
      <View style={styles.chipsRow}>
        {CONDITIONS.map((c) => {
          const active = selected.includes(c);
          return (
            <TouchableOpacity key={c} onPress={() => toggleCondition(c)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{CONDITION_LABELS[c]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.photoBox}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <Text style={styles.photoPlaceholder}>No photo selected</Text>
        )}
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => pickFrom('camera')}>
          <Text style={styles.secondaryButtonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => pickFrom('gallery')}>
          <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, (!photo || selected.length === 0 || loading) && styles.buttonDisabled]}
        onPress={handleAnalyze}
        disabled={!photo || selected.length === 0 || loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Analyze Image</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  logout: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#ccfbf1', borderColor: '#0d9488' },
  chipText: { fontSize: 13, color: '#4b5563' },
  chipTextActive: { color: '#0d9488', fontWeight: '600' },
  photoBox: { height: 260, borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginBottom: 16, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { color: '#9ca3af', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#0d9488', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#0d9488', fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
});
