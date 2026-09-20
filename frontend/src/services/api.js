import axios from 'axios'
import { emitToast } from '../lib/toastBus'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err.config?.url?.endsWith('/auth/login')

    if (!err.response) {
      emitToast({ type: 'error', message: 'Network error — check your connection and try again.' })
    } else if (err.response.status === 401 && !isLoginCall) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        emitToast({ type: 'error', message: 'Your session has expired. Please sign in again.' })
        window.location.href = '/login'
      }
    } else if (err.response.status >= 500) {
      emitToast({ type: 'error', message: 'Something went wrong on our end. Please try again.' })
    }

    return Promise.reject(err)
  }
)

export const login = (email, password) => {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  return api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

export const register = (data) => api.post('/auth/register', data)
export const registerPatient = (data) => api.post('/auth/register-patient', data)
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })
export const resetPassword = (token, new_password) => api.post('/auth/reset-password', { token, new_password })
export const getMe = () => api.get('/auth/me')
export const updateMe = (data) => api.patch('/auth/me', data)
export const changePassword = (data) => api.post('/auth/me/password', data)
export const giveConsent = () => api.post('/auth/me/consent')
export const listUsers = () => api.get('/auth/users')
export const createUser = (data) => api.post('/auth/users', data)
export const deactivateUser = (id) => api.patch(`/auth/users/${id}/deactivate`)

export const analyzeImage = (formData, onUploadProgress) =>
  api.post('/analysis/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })

export const getPatients = () => api.get('/patients/')
export const createPatient = (data) => api.post('/patients/', data)
export const getPatient = (id) => api.get(`/patients/${id}`)
export const createPatientAccount = (patientId, data) => api.post(`/patients/${patientId}/account`, data)
export const assignDoctor = (patientId, doctorId) =>
  api.patch(`/patients/${patientId}/assign-doctor`, { doctor_id: doctorId ?? null })
export const getPatientSessions = (patientId) => api.get(`/sessions/patient/${patientId}`)
export const getSession = (sessionId) => api.get(`/sessions/${sessionId}`)
export const updateDoctorNote = (sessionId, note) => api.patch(`/sessions/${sessionId}/note`, { note })

export const updatePatientNote = (sessionId, note) => api.patch(`/sessions/${sessionId}/patient-note`, { note })
export const getAnalyticsSummary = () => api.get('/analytics/summary')
export const getTreatmentPlans = (patientId) => api.get(`/patients/${patientId}/treatment-plans`)
export const updateSkinHistory = (patientId, data) => api.patch(`/patients/${patientId}/skin-history`, data)
export const getOverdueRecheck = () => api.get('/patients/overdue-recheck')
export const deletePatient = (patientId) => api.delete(`/patients/${patientId}`)
export const exportPatientData = (patientId) => api.get(`/patients/${patientId}/export`)
export const importPatientsCsv = (formData) =>
  api.post('/patients/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const getNotifications = (limit) => api.get('/notifications/', { params: limit ? { limit } : {} })
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.post('/notifications/read-all')

export const getMessages = (patientId) => api.get(`/patients/${patientId}/messages`)
export const sendMessage = (patientId, body) => api.post(`/patients/${patientId}/messages`, { body })
export const getMessagesInbox = () => api.get('/patients/messages/inbox')

export const getAppointments = () => api.get('/appointments/')
export const getAvailableDoctors = () => api.get('/appointments/doctors')
export const createAppointment = (data) => api.post('/appointments/', data)
export const updateAppointmentStatus = (id, status) => api.patch(`/appointments/${id}/status`, { status })

export const getRemedies = () => api.get('/remedies/')
export const updateRemedy = (condition, severity, data) => api.put(`/remedies/${condition}/${severity}`, data)
