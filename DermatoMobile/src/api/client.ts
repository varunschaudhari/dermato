import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Single place to point the app at a backend. Swap API_HOST to retarget —
// e.g. 'http://10.0.2.2:8000' for a local docker-compose backend reached from
// the Android emulator (10.0.2.2 is the emulator's alias for the host
// machine), or a device's real LAN IP for a physical phone on local dev.
// Points at the app's current VPS (see DEPLOY.md) — migrated off the old
// 72.61.231.178 box.
const API_HOST = 'http://187.127.149.141:8081';
const BASE_URL = `${API_HOST}/api`;

// For building absolute URLs from the relative paths the backend returns
// (e.g. session.image_url === "/uploads/xyz.jpg").
export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_HOST}${path}`;
}

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type Severity = 'mild' | 'moderate' | 'severe';

export interface AnalyzeResult {
  session_id: number;
  patient_id: number;
  image_url: string;
  model_powered: boolean;
  severity: Record<string, Severity>;
  wsi: Record<string, number | null>;
  flags: Record<string, string | null>;
  recommendations: Record<string, { type: string; examples: string[]; duration_weeks?: number; escalated?: boolean } | string>;
}

// FastAPI's `detail` field takes three different shapes depending on the
// failure: a plain string (most HTTPExceptions), an object like
// {reason, message} (the quality-gate's rejections), or an ARRAY of Pydantic
// validation-error objects (422s). Rendering the latter two directly as JSX
// text crashes the app — this always resolves to a safe, displayable string.
export function getErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).filter(Boolean).join('; ') || fallback;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message;
  return fallback;
}

export const login = (email: string, password: string) => {
  // Hermes' URLSearchParams support is inconsistent across RN versions — build
  // the form-urlencoded body by hand rather than relying on form.toString().
  const body = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  return api.post('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};

export const getMe = () => api.get('/auth/me');

// The backend always analyzes all four conditions server-side; condition
// selection in this app is a display filter only (applied in ResultsScreen),
// mirroring how the web app's AnalyzePage/ResultsPage split that work.
export const analyzeImage = (patientId: number, photo: { uri: string; type: string; name: string }) => {
  const formData = new FormData();
  // React Native's FormData accepts {uri, type, name} for files, unlike the DOM's File type
  formData.append('file', { uri: photo.uri, type: photo.type, name: photo.name } as any);
  formData.append('patient_id', String(patientId));
  return api.post<AnalyzeResult>('/analysis/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// The web app gets "live" capture feedback by sampling the camera's own video
// element client-side — not possible here, since launchCamera() hands off to
// the OS camera app rather than an in-app view this app controls. This is the
// mobile-shaped equivalent: check the photo the moment it's picked, before
// the patient moves on to configure conditions or submit, instead of only
// finding out after a full /analyze round-trip. Runs the exact same gate
// /analyze itself uses (quality_gate.py) — just without the expensive
// analyzers, so it's fast enough to feel immediate.
export const checkPhotoQuality = (photo: { uri: string; type: string; name: string }) => {
  const formData = new FormData();
  formData.append('file', { uri: photo.uri, type: photo.type, name: photo.name } as any);
  return api.post('/analysis/quality-check', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export interface SessionOut {
  id: number;
  patient_id: number;
  captured_at: string;
  image_url: string;
  acne_severity?: Severity;
  pigmentation_severity?: Severity;
  wrinkle_severity?: Severity;
  pore_severity?: Severity;
  acne_wsi?: number | null;
  pigmentation_wsi?: number | null;
  wrinkle_wsi?: number | null;
  doctor_note?: string | null;
}

export interface TreatmentPlanOut {
  id: number;
  condition: string;
  started_at: string;
  severity_at_start: Severity;
  remedy_type: string;
  remedy_text: string;
  duration_weeks?: string | null;
  expected_recheck_at?: string | null;
  status: 'active' | 'resolved';
  outcome?: 'improved' | 'unchanged' | 'worsened' | null;
}

export const getPatientSessions = (patientId: number) =>
  api.get<SessionOut[]>(`/sessions/patient/${patientId}`);

export const getTreatmentPlans = (patientId: number) =>
  api.get<TreatmentPlanOut[]>(`/patients/${patientId}/treatment-plans`);

export interface SkinHistory {
  allergies?: string;
  current_products?: string;
  known_conditions?: string;
  medications?: string;
  updated_at?: string;
}

export interface PatientOut {
  id: number;
  name: string;
  age?: number | null;
  skin_type?: string | null;
  skin_history?: SkinHistory | null;
}

export const getPatient = (patientId: number) => api.get<PatientOut>(`/patients/${patientId}`);

export const updateSkinHistory = (patientId: number, data: SkinHistory) =>
  api.patch<PatientOut>(`/patients/${patientId}/skin-history`, data);

export interface MessageOut {
  id: number;
  patient_id: number;
  sender_id: number;
  sender_name: string | null;
  sender_role: 'patient' | 'dermatologist' | 'admin';
  body: string;
  created_at: string;
}

export const getMessages = (patientId: number) => api.get<MessageOut[]>(`/patients/${patientId}/messages`);

export const sendMessage = (patientId: number, body: string) =>
  api.post<MessageOut>(`/patients/${patientId}/messages`, { body });

export interface NotificationOut {
  id: number;
  type: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export const getNotifications = () => api.get<NotificationOut[]>('/notifications/');

export const markNotificationRead = (id: number) => api.patch<NotificationOut>(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.post('/notifications/read-all');
