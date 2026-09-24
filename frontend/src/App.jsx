import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/ui/Sidebar'
import TopBar from './components/ui/TopBar'
import BottomNav from './components/ui/BottomNav'
import ProtectedRoute from './components/ui/ProtectedRoute'
import ConsentGate from './components/ui/ConsentGate'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PatientRegisterPage from './pages/PatientRegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AnalyzePage from './pages/AnalyzePage'
import ResultsPage from './pages/ResultsPage'
import PatientsPage from './pages/PatientsPage'
import ProgressPage from './pages/ProgressPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminContentPage from './pages/AdminContentPage'
import DashboardPage from './pages/DashboardPage'
import DoctorWorklistPage from './pages/DoctorWorklistPage'
import ReportPage from './pages/ReportPage'
import PatientChartPage from './pages/PatientChartPage'
import ProfilePage from './pages/ProfilePage'
import AppointmentsPage from './pages/AppointmentsPage'
import MessagesInboxPage from './pages/MessagesInboxPage'
import NotificationsPage from './pages/NotificationsPage'
import ReportsPage from './pages/ReportsPage'
import PatientHomePage from './pages/PatientHomePage'

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
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
