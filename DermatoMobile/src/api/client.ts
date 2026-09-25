import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Single place to point the app at a backend. Swap API_HOST to retarget —
// e.g. 'http://10.0.2.2:8000' for a local docker-compose backend reached from
// the Android emulator (10.0.2.2 is the emulator's alias for the host
// machine), or a device's real LAN IP for a physical phone on local dev.
// Points at the app's current production deployment (see DEPLOY.md) —
// 72.61.231.178 was a prior VPS, since migrated off and its containers
// stopped; it no longer serves anything.
const API_HOST = 'https://dermato.cloud';
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

export interface MlDetection {
  label: string;
  confidence: number;
  box: [number, number, number, number];
}

export interface Overlays {
  acne?: { box: [number, number, number, number] }[];
  pigmentation?: { polygon: [number, number][] }[];
  wrinkle?: { line: [number, number][] }[];
}

export interface AnalyzeResult {
  session_id: number;
  patient_id: number;
  image_url: string;
  model_powered: boolean;
  severity: Record<string, Severity>;
  wsi: Record<string, number | null>;
  flags: Record<string, string | null>;
  previous_severity?: Record<string, Severity>;
  recommendations: Record<
    string,
    { type: string; examples: string[]; duration_weeks?: number; how_to?: string | null; escalated?: boolean; patient_guidance?: string | null } | string
  >;
  overlays?: Overlays;
  ml_detections?: {
    detections: MlDetection[];
    acne_lesion_types?: Record<string, number>;
    skin_problem_counts?: Record<string, number>;
  } | null;
}

export interface ConditionEducation {
  _id: string;
  causes: string;
  what_to_expect: string;
  timeline: string;
  severe_guidance: string;
}

export const getConditionEducation = () => api.get<ConditionEducation[]>('/education/');

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

export const login = (phone: string, password: string) => {
  // Hermes' URLSearchParams support is inconsistent across RN versions — build
  // the form-urlencoded body by hand rather than relying on form.toString().
  // OAuth2PasswordRequestForm's field is always named "username" regardless
  // of what identifier it holds -- it carries the phone number now.
  const body = `username=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`;
  return api.post('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};

export interface WorkingHoursWindow {
  start: string;
  end: string;
}

export interface UserOut {
  id: number;
  phone?: string | null;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  patient_id?: number | null;
  consent_given_at?: string | null;
  bio?: string | null;
  specialization?: string | null;
  credentials?: string | null;
  avatar_url?: string | null;
  working_hours?: Record<string, WorkingHoursWindow> | null;
}

export const getMe = () => api.get<UserOut>('/auth/me');

export const updateMe = (data: { full_name?: string; phone?: string; email?: string }) =>
  api.patch<UserOut>('/auth/me', data);

export const updateDoctorProfile = (data: { bio?: string; specialization?: string; credentials?: string }) =>
  api.patch<UserOut>('/auth/me', data);

export const uploadAvatar = (photo: { uri: string; type: string; name: string }) => {
  const formData = new FormData();
  formData.append('file', { uri: photo.uri, type: photo.type, name: photo.name } as any);
  return api.post<UserOut>('/auth/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const updateWorkingHours = (workingHours: Record<string, WorkingHoursWindow>) =>
  api.patch<UserOut>('/auth/me/working-hours', { working_hours: workingHours });

export const changePassword = (data: { current_password: string; new_password: string }) =>
  api.post('/auth/me/password', data);

export const forgotPassword = (email: string) => api.post('/auth/forgot-password', { email });

export const registerPushToken = (token: string) => api.post('/auth/me/push-token', { token });

export const clearPushToken = () => api.delete('/auth/me/push-token');

export interface RegisterPatientPayload {
  phone: string;
  email: string;
  password: string;
  full_name: string;
  age: number;
  skin_type: string;
}

export const registerPatient = (payload: RegisterPatientPayload) => api.post('/auth/register-patient', payload);

type PhotoAsset = { uri: string; type: string; name: string };

// The backend always analyzes all four conditions server-side; condition
// selection in this app is a display filter only (applied in ResultsScreen),
// mirroring how the web app's AnalyzePage/ResultsPage split that work.
// left/right are optional, same as web's AnalyzePage -- only front is required.
export const analyzeImage = (
  patientId: number,
  photo: PhotoAsset,
  left?: PhotoAsset | null,
  right?: PhotoAsset | null
) => {
  const formData = new FormData();
  // React Native's FormData accepts {uri, type, name} for files, unlike the DOM's File type
  formData.append('file', { uri: photo.uri, type: photo.type, name: photo.name } as any);
  if (left) formData.append('file_left', { uri: left.uri, type: left.type, name: left.name } as any);
  if (right) formData.append('file_right', { uri: right.uri, type: right.type, name: right.name } as any);
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
  patient_note?: string | null;
}

export interface TreatmentPlanOut {
  id: number;
  condition: string;
  started_session_id: number;
  started_at: string;
  severity_at_start: Severity;
  remedy_type: string;
  remedy_text: string;
  how_to?: string | null;
  duration_weeks?: string | null;
  expected_recheck_at?: string | null;
  status: 'active' | 'resolved';
  outcome_severity?: Severity | null;
  outcome?: 'improved' | 'unchanged' | 'worsened' | null;
  adherence?: 'followed' | 'partial' | 'not_followed' | null;
}

export const getPatientSessions = (patientId: number) =>
  api.get<SessionOut[]>(`/sessions/patient/${patientId}`);

export const getTreatmentPlans = (patientId: number) =>
  api.get<TreatmentPlanOut[]>(`/patients/${patientId}/treatment-plans`);

export const updateTreatmentAdherence = (
  patientId: number,
  planId: number,
  adherence: 'followed' | 'partial' | 'not_followed'
) => api.patch<TreatmentPlanOut>(`/patients/${patientId}/treatment-plans/${planId}/adherence`, { adherence });

export interface TreatmentChecklist {
  date: string;
  items: string[];
  completed_indices: number[];
}

export const getTreatmentChecklist = (patientId: number, planId: number, date?: string) =>
  api.get<TreatmentChecklist>(`/patients/${patientId}/treatment-plans/${planId}/checklist`, {
    params: date ? { date } : {},
  });

export const updateTreatmentChecklist = (
  patientId: number,
  planId: number,
  payload: { index: number; completed: boolean; date?: string }
) => api.patch<TreatmentChecklist>(`/patients/${patientId}/treatment-plans/${planId}/checklist`, payload);

export const updatePatientNote = (sessionId: number, note: string) =>
  api.patch<SessionOut>(`/sessions/${sessionId}/patient-note`, { note });

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

export const getNotifications = (limit?: number, skip?: number) =>
  api.get<NotificationOut[]>('/notifications/', { params: { ...(limit ? { limit } : {}), ...(skip ? { skip } : {}) } });

export const markNotificationRead = (id: number) => api.patch<NotificationOut>(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.post('/notifications/read-all');

export interface DoctorOption {
  id: number;
  full_name: string | null;
  specialization?: string | null;
  credentials?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export const getAvailableDoctors = () => api.get<DoctorOption[]>('/appointments/doctors');

export const getDoctorBusyTimes = (doctorId: number, date: string) =>
  api.get<string[]>(`/appointments/doctors/${doctorId}/busy-times`, { params: { date } });

export interface AvailableSlots {
  configured: boolean;
  slots: string[];
}

export const getAvailableSlots = (doctorId: number, date: string) =>
  api.get<AvailableSlots>(`/appointments/doctors/${doctorId}/available-slots`, { params: { date } });

export interface AppointmentOut {
  id: number;
  patient_id: number;
  patient_name: string;
  doctor_id: number;
  doctor_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  reason?: string | null;
  created_at: string;
}

export const getAppointments = () => api.get<AppointmentOut[]>('/appointments/');

export const createAppointment = (data: { patient_id: number; doctor_id: number; scheduled_at: string; reason?: string | null }) =>
  api.post<AppointmentOut>('/appointments/', data);

export const updateAppointmentStatus = (id: number, status: 'completed' | 'cancelled') =>
  api.patch<AppointmentOut>(`/appointments/${id}/status`, { status });
