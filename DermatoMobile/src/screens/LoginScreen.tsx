import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { COLORS } from '../constants';
import FormError from '../components/FormError';

type RootStackParamList = { Login: undefined; Register: undefined; ForgotPassword: undefined };

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(phone, password);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Login failed. Check your mobile number and password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>D</Text>
      </View>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to your Dermato account</Text>

      {error ? <FormError message={error} /> : null}

      <Text style={styles.label}>Mobile number or email</Text>
      <View style={styles.inputWrapper}>
        <User size={16} color="#9ca3af" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          value={phone}
          onChangeText={setPhone}
          placeholder="9876543210 or you@example.com"
        />
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.inputWrapper}>
        <Lock size={16} color="#9ca3af" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, styles.inputWithToggle]}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
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

      <TouchableOpacity
        style={[styles.button, (!phone.trim() || !password || loading) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!phone.trim() || !password || loading}
        accessibilityRole="button"
        accessibilityLabel="Sign in"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotLink}
        accessibilityRole="button"
        accessibilityLabel="Forgot password"
      >
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
        style={styles.registerLink}
        accessibilityRole="button"
        accessibilityLabel="Create an account"
      >
        <Text style={styles.registerLinkText}>
          New patient? <Text style={styles.registerLinkBold}>Create an account</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
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
  button: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  forgotLink: { marginTop: 14 },
  forgotLinkText: { textAlign: 'center', fontSize: 13, color: COLORS.teal, fontWeight: '600' },
  registerLink: { marginTop: 20 },
  registerLinkText: { textAlign: 'center', fontSize: 13, color: COLORS.secondaryText },
  registerLinkBold: { color: COLORS.teal, fontWeight: '700' },
});
