import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User, Mail, Phone, Lock, Calendar, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { registerPatient, getErrorMessage } from '../api/client';
import { COLORS } from '../constants';
import FormError from '../components/FormError';

type RootStackParamList = { Login: undefined; Register: undefined };

const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'];

export default function RegisterScreen() {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', age: '', skin_type: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSubmit = async () => {
    if (!form.full_name || !form.phone || !form.email || !form.password || !form.age || !form.skin_type) {
      setError('Please fill in every field.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await registerPatient({ ...form, age: Number(form.age) });
      await loginWithToken(data.access_token);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>D</Text>
        </View>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sign up to start tracking your skin health</Text>

        {error ? <FormError message={error} /> : null}

        <Text style={styles.label}>Full name</Text>
        <View style={styles.inputWrapper}>
          <User size={16} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={(v) => setForm({ ...form, full_name: v })}
            placeholder="Jane Doe"
          />
        </View>

        <Text style={styles.label}>Mobile number</Text>
        <View style={styles.inputWrapper}>
          <Phone size={16} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(v) => setForm({ ...form, phone: v })}
            placeholder="9876543210"
          />
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrapper}>
          <Mail size={16} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
            placeholder="you@example.com"
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrapper}>
          <Lock size={16} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, styles.inputWithToggle]}
            secureTextEntry={!showPassword}
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            placeholder="At least 8 characters"
          />
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Age</Text>
        <View style={styles.inputWrapper}>
          <Calendar size={16} color="#9ca3af" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={form.age}
            onChangeText={(v) => setForm({ ...form, age: v })}
            placeholder="e.g. 28"
          />
        </View>

        <Text style={styles.label}>Skin type</Text>
        <View style={styles.chipsRow}>
          {SKIN_TYPES.map((t) => {
            const active = form.skin_type === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setForm({ ...form, skin_type: t })}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.loginLink}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  container: { padding: 24, paddingTop: 48 },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.teal, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: COLORS.heading },
  subtitle: { fontSize: 14, color: COLORS.secondaryText, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  label: { fontSize: 13, color: '#4b5563', marginBottom: 4 },
  inputWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 16 },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingLeft: 36, paddingRight: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' },
  inputWithToggle: { paddingRight: 40 },
  toggleButton: { position: 'absolute', right: 10, padding: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#ccfbf1', borderColor: COLORS.teal },
  chipText: { fontSize: 13, color: '#4b5563' },
  chipTextActive: { color: COLORS.teal, fontWeight: '600' },
  button: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  loginLink: { marginTop: 20, marginBottom: 20 },
  loginLinkText: { textAlign: 'center', fontSize: 13, color: COLORS.secondaryText },
  loginLinkBold: { color: COLORS.teal, fontWeight: '700' },
});
