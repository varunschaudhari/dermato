import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/ui/Sidebar'
import TopBar from './components/ui/TopBar'
import BottomNav from './components/ui/BottomNav'
import ProtectedRoute from './components/ui/ProtectedRoute'
import ConsentGate from './components/ui/ConsentGate'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const PatientRegisterPage = lazy(() => import('./pages/PatientRegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AnalyzePage = lazy(() => import('./pages/AnalyzePage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const PatientsPage = lazy(() => import('./pages/PatientsPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminContentPage = lazy(() => import('./pages/AdminContentPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const DoctorWorklistPage = lazy(() => import('./pages/DoctorWorklistPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const PatientChartPage = lazy(() => import('./pages/PatientChartPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'))
const MessagesInboxPage = lazy(() => import('./pages/MessagesInboxPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const PatientHomePage = lazy(() => import('./pages/PatientHomePage'))

export default function App() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 md:flex">
      <ConsentGate />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-6 sm:py-8 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto w-full">
            <div key={pathname} className="animate-fade-in">
              <Suspense
                fallback={
                  <div className="min-h-[50vh] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/patient-register" element={<PatientRegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/home"
                  element={
                    <ProtectedRoute roles={['patient']}>
                      <PatientHomePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <AnalyzePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/results"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <ResultsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patients"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist']}>
                      <PatientsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/progress/:patientId" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
                <Route
                  path="/patients/:patientId/chart"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <PatientChartPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/report/:sessionId"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <ReportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute roles={['admin']}>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worklist"
                  element={
                    <ProtectedRoute roles={['dermatologist']}>
                      <DoctorWorklistPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute roles={['admin']}>
                      <AdminUsersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/content"
                  element={
                    <ProtectedRoute roles={['admin']}>
                      <AdminContentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <AppointmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist']}>
                      <MessagesInboxPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute roles={['admin', 'dermatologist', 'patient']}>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
              </Suspense>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
