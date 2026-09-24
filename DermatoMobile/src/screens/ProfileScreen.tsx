import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { getMe, updateMe, changePassword, getErrorMessage, UserOut } from '../api/client';
import { COLORS } from '../constants';

type RootStackParamList = { MainTabs: undefined };

export default function ProfileScreen() {
  const { logout, updateFullName } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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

  useEffect(() => {
    getMe().then(({ data }) => {
      setMe(data);
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setEmail(data.email);
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
        {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change password</Text>
        {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
        <Text style={styles.fieldLabel}>Current password</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Text style={styles.fieldLabel}>New password</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
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
  fieldLabel: { fontSize: 12, color: COLORS.secondaryText, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: COLORS.divider, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.heading, backgroundColor: '#fff' },
  saveButton: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 13 },
  logoutButton: { alignItems: 'center', paddingVertical: 14 },
  logoutButtonText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
});
