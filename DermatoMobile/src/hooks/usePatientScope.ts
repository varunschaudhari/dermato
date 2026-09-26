import { useAuth } from '../context/AuthContext';
import { useSelectedPatient } from '../context/SelectedPatientContext';

export interface PatientScope {
  patientId: number | null;
  patientName: string | null;
  // True only when the viewer IS the patient -- gates patient-self-report
  // affordances (treatment adherence chips, routine checklist, "My Notes").
  // The backend enforces the same rule server-side (403s these for any
  // non-patient role), so getting this wrong in the UI produces a blocked
  // action, not a data leak -- but a proper view-only state is better UX
  // than a raw error toast.
  canEdit: boolean;
  isOwn: boolean;
}

// The single seam every patient-scoped screen reads through instead of
// useAuth().patientId directly. A patient viewing their own data always gets
// their own id; a dermatologist gets whichever patient was picked via
// PatientListScreen/DoctorHomeScreen/MessagesInboxScreen (see
// SelectedPatientContext).
export function usePatientScope(): PatientScope {
  const { role, patientId, fullName } = useAuth();
  const { selectedPatientId, selectedPatientName } = useSelectedPatient();

  if (role === 'patient') {
    return { patientId, patientName: fullName, canEdit: true, isOwn: true };
  }
  return { patientId: selectedPatientId, patientName: selectedPatientName, canEdit: false, isOwn: false };
}
