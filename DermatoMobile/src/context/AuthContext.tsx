import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as loginApi, getMe, clearPushToken, UserOut } from '../api/client';
import { registerForPushNotifications } from '../services/pushNotifications';

// Roles allowed into this app. Admin-only web features (practice-wide
// analytics, staff management, content editor, bulk CSV import) are
// desk-oriented and don't have a mobile screen -- admins keep using the web
// portal. patient_id is null for a legitimate dermatologist session (they
// have no patient record of their own), so it can't be used as the gate.
const ALLOWED_ROLES = ['patient', 'dermatologist'];

interface AuthState {
  loading: boolean;
  token: string | null;
  role: string | null;
  userId: number | null;
  patientId: number | null;
  fullName: string | null;
  login: (phone: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateFullName: (name: string) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function assertAllowedRole(me: UserOut) {
  if (!ALLOWED_ROLES.includes(me.role)) {
    throw new Error('This app is for patients and dermatologists. Admins should sign in at dermato.cloud on the web.');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('token').then(async (stored) => {
      if (stored) {
        try {
          const { data } = await getMe();
          assertAllowedRole(data);
          setToken(stored);
          setRole(data.role);
          setUserId(data.id);
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
    const me = await getMe();
    try {
      assertAllowedRole(me.data);
    } catch (err) {
      await AsyncStorage.removeItem('token');
      throw err;
    }
    setToken(accessToken);
    setRole(me.data.role);
    setUserId(me.data.id);
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
    setRole(null);
    setUserId(null);
    setPatientId(null);
    setFullName(null);
  };

  return (
    <AuthContext.Provider
      value={{ loading, token, role, userId, patientId, fullName, login, loginWithToken, logout, updateFullName: setFullName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
