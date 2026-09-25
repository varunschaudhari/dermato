import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import {
  getMe,
  updateMe,
  changePassword,
  updateDoctorProfile,
  uploadAvatar,
  updateWorkingHours,
  getErrorMessage,
  UserOut,
  WorkingHoursWindow,
} from '../api/client';
import { COLORS, SPACING } from '../constants';
import FormError from '../components/FormError';
import { useToast } from '../context/ToastContext';

type RootStackParamList = { MainTabs: undefined };

const WORKING_DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function ProfileScreen() {
  const { logout, updateFullName } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const toast = useToast();

  const [me, setMe] = useState<UserOut | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [specialization, setSpecialization] = useState('');
  const [credentials, setCredentials] = useState('');
  const [bio, setBio] = useState('');
  const [doctorError, setDoctorError] = useState('');
  const [doctorSaving, setDoctorSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [hoursForm, setHoursForm] = useState<Record<string, WorkingHoursWindow | null>>({});
  const [hoursError, setHoursError] = useState('');
  const [hoursSaving, setHoursSaving] = useState(false);

  useEffect(() => {
    getMe().then(({ data }) => {
      setMe(data);
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setEmail(data.email);
      setSpecialization(data.specialization || '');
      setCredentials(data.credentials || '');
      setBio(data.bio || '');
      const initialHours: Record<string, WorkingHoursWindow | null> = {};
      WORKING_DAYS.forEach(({ key }) => {
        initialHours[key] = data.working_hours?.[key] || null;
      });
      setHoursForm(initialHours);
    });
  }, []);

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSaving(true);
    try {
      await updateMe({ full_name: fullName, phone, email });
      updateFullName(fullName);
    } catch (err: any) {
      setProfileError(getErrorMessage(err, 'Could not update profile.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSaving(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPasswordError(getErrorMessage(err, 'Could not update password.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveDoctorProfile = async () => {
    setDoctorError('');
    setDoctorSaving(true);
    try {
      const { data } = await updateDoctorProfile({ specialization, credentials, bio });
      setMe(data);
      toast.success('Doctor profile updated.');
    } catch (err: any) {
      setDoctorError(getErrorMessage(err, 'Could not update doctor profile.'));
    } finally {
      setDoctorSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel || result.errorCode) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setAvatarUploading(true);
    try {
      const { data } = await uploadAvatar({ uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'avatar.jpg' });
      setMe(data);
      toast.success('Photo updated.');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Could not upload photo.'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const toggleWorkingDay = (key: string) => {
    setHoursForm((prev) => ({ ...prev, [key]: prev[key] ? null : { start: '09:00', end: '17:00' } }));
  };

  const setWorkingDayTime = (key: string, field: 'start' | 'end', value: string) => {
    setHoursForm((prev) => ({ ...prev, [key]: { ...(prev[key] as WorkingHoursWindow), [field]: value } }));
  };

  const handleSaveHours = async () => {
    setHoursError('');
    setHoursSaving(true);
    try {
      const workingHours: Record<string, WorkingHoursWindow> = {};
      Object.entries(hoursForm).forEach(([key, window]) => {
        if (window) workingHours[key] = window;
      });
      const { data } = await updateWorkingHours(workingHours);
      setMe(data);
      toast.success('Working hours updated.');
    } catch (err: any) {
      setHoursError(getErrorMessage(err, 'Could not update working hours.'));
    } finally {
      setHoursSaving(false);
    }
  };

  if (!me) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.teal} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>My Profile</Text>
      <Text style={styles.subtitle}>Manage your account details and password</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account details</Text>
        {profileError ? <FormError message={profileError} /> : null}
        <Text style={styles.fieldLabel}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
        <Text style={styles.fieldLabel}>Mobile number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={profileSaving} accessibilityRole="button" accessibilityLabel="Save changes">
          <Text style={styles.saveButtonText}>{profileSaving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>

      {me.role === 'dermatologist' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Doctor profile</Text>
          <View style={styles.avatarRow}>
            {me.avatar_url ? (
              <Image source={{ uri: me.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{(me.full_name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <TouchableOpacity onPress={handlePickAvatar} disabled={avatarUploading} accessibilityRole="button" accessibilityLabel="Change photo">
              <Text style={styles.avatarLink}>{avatarUploading ? 'Uploading…' : 'Change photo'}</Text>
            </TouchableOpacity>
          </View>
          {doctorError ? <FormError message={doctorError} /> : null}
          <Text style={styles.fieldLabel}>Specialization</Text>
          <TextInput style={styles.input} value={specialization} onChangeText={setSpecialization} placeholder="e.g. Cosmetic Dermatology" />
          <Text style={styles.fieldLabel}>Credentials</Text>
          <TextInput style={styles.input} value={credentials} onChangeText={setCredentials} placeholder="e.g. MBBS, MD Dermatology" />
          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="A short introduction patients will see when choosing a doctor."
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveDoctorProfile}
            disabled={doctorSaving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <Text style={styles.saveButtonText}>{doctorSaving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {me.role === 'dermatologist' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Working hours</Text>
          <Text style={styles.cardSubtitle}>Patients only see bookable slots inside these hours.</Text>
          {hoursError ? <FormError message={hoursError} /> : null}
          {WORKING_DAYS.map(({ key, label }) => (
            <View key={key} style={styles.dayRow}>
              <TouchableOpacity
                style={styles.dayToggle}
                onPress={() => toggleWorkingDay(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!hoursForm[key] }}
                accessibilityLabel={label}
              >
                <View style={[styles.checkbox, hoursForm[key] && styles.checkboxChecked]} />
                <Text style={styles.dayLabel}>{label}</Text>
              </TouchableOpacity>
              {hoursForm[key] ? (
                <View style={styles.dayTimeRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={hoursForm[key]?.start}
                    onChangeText={(v) => setWorkingDayTime(key, 'start', v)}
                    placeholder="09:00"
                  />
                  <Text style={styles.dayTimeSep}>to</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={hoursForm[key]?.end}
                    onChangeText={(v) => setWorkingDayTime(key, 'end', v)}
                    placeholder="17:00"
                  />
                </View>
              ) : (
                <Text style={styles.dayUnavailable}>Unavailable</Text>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveHours}
            disabled={hoursSaving}
            accessibilityRole="button"
            accessibilityLabel="Save working hours"
          >
            <Text style={styles.saveButtonText}>{hoursSaving ? 'Saving…' : 'Save working hours'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change password</Text>
        {passwordError ? <FormError message={passwordError} /> : null}
        <Text style={styles.fieldLabel}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.fieldLabel}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleChangePassword}
          disabled={passwordSaving || !currentPassword || newPassword.length < 8}
          accessibilityRole="button"
          accessibilityLabel="Update password"
        >
          <Text style={styles.saveButtonText}>{passwordSaving ? 'Updating…' : 'Update password'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About &amp; legal</Text>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => Linking.openURL('https://dermato.cloud/privacy.html')}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => Linking.openURL('https://dermato.cloud/terms.html')}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          <Text style={styles.legalLink}>Terms of Service</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout} accessibilityRole="button" accessibilityLabel="Log out">
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.heading },
  subtitle: { fontSize: 13, color: COLORS.secondaryText, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.heading, marginBottom: 12 },
  cardSubtitle: { fontSize: 12, color: COLORS.secondaryText, marginTop: -8, marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: COLORS.secondaryText, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.heading, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutButton: { alignItems: 'center', paddingVertical: 14 },
  logoutButtonText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: COLORS.teal, fontWeight: '700', fontSize: 20 },
  avatarLink: { color: COLORS.teal, fontWeight: '600', fontSize: 13 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 130 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.divider },
  checkboxChecked: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  dayLabel: { fontSize: 13, color: COLORS.heading },
  dayTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: COLORS.heading,
    width: 64,
    textAlign: 'center',
  },
  dayTimeSep: { fontSize: 11, color: COLORS.mutedGray },
  dayUnavailable: { fontSize: 12, color: COLORS.mutedGray },
  legalRow: { paddingVertical: 8 },
  legalLink: { color: COLORS.teal, fontWeight: '600', fontSize: 14 },
});
