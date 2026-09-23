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
        setToken(stored);
        try {
          const { data } = await getMe();
          setPatientId(data.patient_id ?? null);
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
    setToken(accessToken);
    const me = await getMe();
    setPatientId(me.data.patient_id ?? null);
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
    <AuthContext.Provider value={{ loading, token, patientId, fullName, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
