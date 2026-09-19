import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 10.0.2.2 is the Android emulator's alias for the host machine — the backend
// runs there via docker-compose on port 8000. A physical device would need the
// host's real LAN IP (or a tunnel URL) instead; not needed for this dev setup.
const BASE_URL = 'http://10.0.2.2:8000/api';

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
