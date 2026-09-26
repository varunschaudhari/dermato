import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as loginApi, getMe, clearPushToken } from '../api/client';
import { registerForPushNotifications } from '../services/pushNotifications';

interface AuthState {
  loading: boolean;
  token: string | null;
  patientId: number | null;
  fullName: string | null;
  login: (phone: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateFullName: (name: string) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (stored) => {
      if (stored) {
        try {
          const { data } = await getMe();
          // This app only has patient-facing screens (Home/Analyze/History/
          // Progress all key off patientId) -- a dermatologist or admin token
          // has patient_id: null and would land on a UI with no working
          // actions at all, e.g. Analyze silently no-ops on submit. Treat it
          // the same as an invalid session rather than let them in.
          if (data.patient_id == null) throw new Error('not a patient account');
          setToken(stored);
          setPatientId(data.patient_id);
          setFullName(data.full_name ?? null);
          registerForPushNotifications();
        } catch {
          await AsyncStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    });
  }, []);

  // Shared by both sign-in (after exchanging credentials for a token) and
  // registration (which already gets a token back from register-patient) —
  // stores it and hydrates the user's identity the same way either path.
  const loginWithToken = async (accessToken: string) => {
    await AsyncStorage.setItem('token', accessToken);
    const me = await getMe();
    if (me.data.patient_id == null) {
      await AsyncStorage.removeItem('token');
      throw new Error('This app is for patients. Dermatologists and staff should sign in at dermato.cloud on the web.');
    }
    setToken(accessToken);
    setPatientId(me.data.patient_id);
    setFullName(me.data.full_name ?? null);
    registerForPushNotifications();
  };

  const login = async (phone: string, password: string) => {
    const { data } = await loginApi(phone, password);
    await loginWithToken(data.access_token);
  };

  const logout = async () => {
    // Clear server-side before dropping the local token -- clearPushToken is an
    // authenticated call, so a shared/reset device doesn't keep receiving the
    // outgoing user's pushes after this. Best-effort: a network hiccup here
    // shouldn't block signing out.
    try {
      await clearPushToken();
    } catch {}
    await AsyncStorage.removeItem('token');
    setToken(null);
    setPatientId(null);
    setFullName(null);
  };

  return (
    <AuthContext.Provider value={{ loading, token, patientId, fullName, login, loginWithToken, logout, updateFullName: setFullName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
