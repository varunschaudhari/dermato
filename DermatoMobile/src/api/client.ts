import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Single place to point the app at a backend. Swap API_HOST to retarget —
// e.g. 'http://10.0.2.2:8000' for a local docker-compose backend reached from
// the Android emulator (10.0.2.2 is the emulator's alias for the host
// machine), or a device's real LAN IP for a physical phone on local dev.
const API_HOST = 'http://72.61.231.178:8081';
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
  // @ts-expect-error React Native's FormData accepts {uri, type, name} for files, unlike the DOM's File type
  formData.append('file', { uri: photo.uri, type: photo.type, name: photo.name });
  formData.append('patient_id', String(patientId));
  return api.post<AnalyzeResult>('/analysis/analyze', formData, {
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
