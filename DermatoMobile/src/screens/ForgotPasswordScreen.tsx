import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, CheckCircle2 } from 'lucide-react-native';
import { forgotPassword } from '../api/client';
import { COLORS } from '../constants';

type RootStackParamList = { Login: undefined; ForgotPassword: undefined };

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await forgotPassword(email);
    } finally {
      // Always show the same confirmation, whether or not the email exists --
      // the backend intentionally doesn't reveal that either (see ForgotPasswordPage.jsx).
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.subtitle}>Enter your email and we'll send you a reset link</Text>

      {sent ? (
        <View style={styles.confirmation}>
          <CheckCircle2 size={40} color={COLORS.teal} style={{ marginBottom: 12 }} />
          <Text style={styles.confirmationText}>
            If <Text style={{ fontWeight: '600' }}>{email}</Text> is registered, a reset link is on its way. Open it from
            your phone's browser to finish resetting your password.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Mail size={16} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading || !email}
            accessibilityRole="button"
            accessibilityLabel="Send reset link"
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset link</Text>}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backLink} accessibilityRole="button" accessibilityLabel="Back to sign in">
        <Text style={styles.backLinkText}>Back to sign in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: COLORS.heading },
  subtitle: { fontSize: 14, color: COLORS.secondaryText, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  label: { fontSize: 13, color: '#4b5563', marginBottom: 4 },
  inputWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 16 },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingLeft: 36, paddingRight: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' },
  button: { backgroundColor: COLORS.teal, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  confirmation: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  confirmationText: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20 },
  backLink: { marginTop: 20 },
  backLinkText: { textAlign: 'center', fontSize: 13, color: COLORS.teal, fontWeight: '600' },
});
