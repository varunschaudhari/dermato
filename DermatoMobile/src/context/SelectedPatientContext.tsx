import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

// Holds "which patient a dermatologist is currently looking at" -- only
// meaningful for a dermatologist session, but harmless to always mount.
// Analyze/History/Progress are root-Stack screens for a dermatologist (see
// App.tsx), reachable only via an explicit navigate() from PatientListScreen/
// DoctorHomeScreen/MessagesInboxScreen, each of which calls setSelectedPatient
// first -- so in practice this is never read before being set for that role.
interface SelectedPatientState {
  selectedPatientId: number | null;
  selectedPatientName: string | null;
  setSelectedPatient: (id: number, name: string) => void;
  clearSelectedPatient: () => void;
}

const SelectedPatientContext = createContext<SelectedPatientState | undefined>(undefined);

export function SelectedPatientProvider({ children }: { children: React.ReactNode }) {
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const { userId } = useAuth();

  // Forget the selection whenever the signed-in user changes (logout sets
  // userId to null). This provider outlives login sessions, so without this,
  // a second doctor on the same phone would open Analyze still "acting for"
  // the previous doctor's patient and could save a scan to their record.
  useEffect(() => {
    setSelectedPatientId(null);
    setSelectedPatientName(null);
  }, [userId]);

  const setSelectedPatient = (id: number, name: string) => {
    setSelectedPatientId(id);
    setSelectedPatientName(name);
  };

  const clearSelectedPatient = () => {
    setSelectedPatientId(null);
    setSelectedPatientName(null);
  };

  return (
    <SelectedPatientContext.Provider value={{ selectedPatientId, selectedPatientName, setSelectedPatient, clearSelectedPatient }}>
      {children}
    </SelectedPatientContext.Provider>
  );
}

export function useSelectedPatient(): SelectedPatientState {
  const ctx = useContext(SelectedPatientContext);
  if (!ctx) throw new Error('useSelectedPatient must be used within a SelectedPatientProvider');
  return ctx;
}
