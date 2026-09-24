import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Lightbulb, Check, Plus } from 'lucide-react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { analyzeImage, checkPhotoQuality, getErrorMessage } from '../api/client';
import { COLORS } from '../constants';

type QualityStatus = 'idle' | 'checking' | 'ok' | 'failed';
type Angle = 'front' | 'left' | 'right';
type Photos = Record<Angle, Asset | null>;

const ANGLES: { key: Angle; label: string; required: boolean }[] = [
  { key: 'front', label: 'Front', required: true },
  { key: 'left', label: 'Left angle', required: false },
  { key: 'right', label: 'Right angle', required: false },
];

// General good-practice guidance, not a precise measured protocol -- there's
// no documented/enforced capture distance anywhere in this app (checked the
// project's own spec docs and both capture UIs), so this deliberately stays
// qualitative rather than inventing a specific number like "15cm away".
const CAPTURE_TIPS = [
  'Get close -- fill the frame with the area you want checked, not your whole face.',
  'Use even daylight or bright indoor light; avoid harsh shadows or backlight.',
  'Hold steady and keep the camera parallel to your skin.',
];

// Results lives in the root Stack (a sibling of MainTabs), not inside the tab
// navigator Analyze belongs to — navigate() still finds it by bubbling up to
// the parent navigator, this type just describes where it actually lives.
type RootStackParamList = { MainTabs: undefined; Results: { result: any } };

export default function AnalyzeScreen() {
  const [photos, setPhotos] = useState<Photos>({ front: null, left: null, right: null });
  const [activeAngle, setActiveAngle] = useState<Angle>('front');
  // Quality precheck only ever applies to the front photo -- it's the one
  // required, primary diagnostic shot the submit gate cares about; left/right
  // are optional supplementary context, same as the web app's treatment of them.
  const [qualityStatus, setQualityStatus] = useState<QualityStatus>('idle');
  const [qualityMessage, setQualityMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { patientId, logout, fullName } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const photo = photos[activeAngle];

  // Checks the photo the moment it's picked, not just when Analyze is finally
  // tapped — see checkPhotoQuality's comment in api/client.ts for why this is
  // a separate precheck call rather than the live-video feedback the web app
  // gets. A network/timeout failure here is inconclusive, not a bad photo —
  // don't block the patient over a flaky connection; the real /analyze call
  // runs this exact same gate again anyway.
  const runQualityCheck = async (asset: Asset) => {
    setQualityStatus('checking');
    setQualityMessage('');
    try {
      await checkPhotoQuality({ uri: asset.uri!, type: asset.type || 'image/jpeg', name: asset.fileName || 'photo.jpg' });
      setQualityStatus('ok');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
        setQualityStatus('failed');
        setQualityMessage(detail.message);
      } else {
        setQualityStatus('idle');
      }
    }
  };

  const pickFrom = async (source: 'camera' | 'gallery', angle: Angle) => {
    const result = source === 'camera' ? await launchCamera({ mediaType: 'photo', quality: 0.8 }) : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    // Both didCancel and errorCode leave `assets` empty -- without checking
    // these first, a denied permission or a camera-less device (e.g. some
    // emulators) looked identical to the button doing nothing at all.
    if (result.didCancel) return;
    if (result.errorCode) {
      setError(
        result.errorCode === 'camera_unavailable'
          ? 'No camera available on this device.'
          : result.errorCode === 'permission'
          ? 'Camera permission was denied. Enable it in your device settings to take a photo.'
          : result.errorMessage || 'Could not open the camera.'
      );
      return;
    }
    const asset = result.assets?.[0];
    if (asset) {
      setPhotos((prev) => ({ ...prev, [angle]: asset }));
      if (angle === 'front') runQualityCheck(asset);
    }
  };

  const handleAnalyze = async () => {
    // 'idle' here means the precheck itself was inconclusive (e.g. network
    // hiccup), not that the photo failed — only a confirmed 'failed' or a
    // check still in flight should block submission.
    if (!photos.front || !patientId || qualityStatus === 'checking' || qualityStatus === 'failed') return;
    setLoading(true);
    setError('');
    try {
      const toPhotoPayload = (a: Asset) => ({ uri: a.uri!, type: a.type || 'image/jpeg', name: a.fileName || 'photo.jpg' });
      const { data } = await analyzeImage(
        patientId,
        toPhotoPayload(photos.front),
        photos.left ? toPhotoPayload(photos.left) : undefined,
        photos.right ? toPhotoPayload(photos.right) : undefined
      );
      navigation.navigate('Results', { result: data });
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
        <TouchableOpacity onPress={logout} accessibilityRole="button" accessibilityLabel="Log out">
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>{fullName ? `Hi ${fullName.split(' ')[0]} — ` : ''}Upload a clear, well-lit photo to get started</Text>

      <View style={styles.tipsBox}>
        <Lightbulb size={16} color="#d97706" style={styles.tipsIcon} />
        <View style={styles.tipsTextWrap}>
          {CAPTURE_TIPS.map((tip) => (
            <Text key={tip} style={styles.tipsText}>{tip}</Text>
          ))}
        </View>
      </View>

      <View style={styles.angleRow}>
        {ANGLES.map(({ key, label, required }) => {
          const captured = !!photos[key];
          const active = activeAngle === key;
          if (!required && !captured && !active) {
            return (
              <TouchableOpacity
                key={key}
                style={styles.angleChipAdd}
                onPress={() => setActiveAngle(key)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${label.toLowerCase()}`}
              >
                <Plus size={12} color={COLORS.teal} />
                <Text style={styles.angleChipAddText}>{label}</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={key}
              style={[styles.angleChip, active && styles.angleChipActive]}
              onPress={() => setActiveAngle(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              {captured && <Check size={12} color={active ? '#fff' : COLORS.teal} />}
              <Text style={[styles.angleChipText, active && styles.angleChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.photoBox}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} accessibilityLabel={`Selected ${activeAngle} photo preview`} />
        ) : (
          <Text style={styles.photoPlaceholder}>No photo selected</Text>
        )}
        {activeAngle === 'front' && qualityStatus === 'checking' && (
          <View style={styles.qualityOverlay}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.qualityOverlayText}>Checking photo quality…</Text>
          </View>
        )}
      </View>

      {activeAngle === 'front' && qualityStatus === 'ok' && (
        <View style={styles.qualityOk}>
          <Text style={styles.qualityOkText}>✓ Looks good</Text>
        </View>
      )}
      {activeAngle === 'front' && qualityStatus === 'failed' && (
        <View style={styles.qualityFailed}>
          <Text style={styles.qualityFailedText}>{qualityMessage}</Text>
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => pickFrom('camera', activeAngle)}
          accessibilityRole="button"
          accessibilityLabel="Take Photo"
        >
          <Text style={styles.secondaryButtonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => pickFrom('gallery', activeAngle)}
          accessibilityRole="button"
          accessibilityLabel="Choose from Gallery"
        >
          <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[
          styles.button,
          (!photos.front || loading || qualityStatus === 'checking' || qualityStatus === 'failed') &&
            styles.buttonDisabled,
        ]}
        onPress={handleAnalyze}
        disabled={!photos.front || loading || qualityStatus === 'checking' || qualityStatus === 'failed'}
        accessibilityRole="button"
        accessibilityLabel="Analyze Image"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Analyze Image</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading },
  logout: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  subtitle: { fontSize: 13, color: COLORS.secondaryText, marginTop: 4, marginBottom: 16 },
  tipsBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginBottom: 16 },
  tipsIcon: { marginTop: 2 },
  tipsTextWrap: { flex: 1, gap: 3 },
  tipsText: { fontSize: 12, color: '#4b5563', lineHeight: 17 },
  angleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  angleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.teal, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  angleChipActive: { backgroundColor: COLORS.teal },
  angleChipText: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  angleChipTextActive: { color: '#fff' },
  angleChipAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.divider, borderStyle: 'dashed', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  angleChipAddText: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  photoBox: { height: 260, borderRadius: 16, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden', position: 'relative' },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { color: COLORS.mutedGray, fontSize: 13 },
  qualityOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  qualityOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  qualityOk: { backgroundColor: '#f0fdfa', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12 },
  qualityOkText: { color: '#0f766e', fontSize: 13, fontWeight: '600' },
  qualityFailed: { backgroundColor: '#fef2f2', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12 },
  qualityFailedText: { color: '#b91c1c', fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: COLORS.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: COLORS.teal, fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 },
});
