import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SelectedPatientProvider, useSelectedPatient } from '../src/context/SelectedPatientContext';
import { useAuth } from '../src/context/AuthContext';

jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
const mockUseAuth = useAuth as jest.Mock;

let latest: ReturnType<typeof useSelectedPatient>;
function Probe() {
  latest = useSelectedPatient();
  return null;
}

const tree = () => (
  <SelectedPatientProvider>
    <Probe />
  </SelectedPatientProvider>
);

test('selected patient is cleared when the doctor logs out or another user signs in', async () => {
  mockUseAuth.mockReturnValue({ userId: 7 });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(tree());
  });

  await ReactTestRenderer.act(async () => latest.setSelectedPatient(42, 'Asha'));
  expect(latest.selectedPatientId).toBe(42);

  // Logout: AuthContext sets userId to null.
  mockUseAuth.mockReturnValue({ userId: null });
  await ReactTestRenderer.act(async () => renderer.update(tree()));
  expect(latest.selectedPatientId).toBeNull();
  expect(latest.selectedPatientName).toBeNull();

  // A second doctor signs in on the same phone and selects their own patient.
  mockUseAuth.mockReturnValue({ userId: 8 });
  await ReactTestRenderer.act(async () => renderer.update(tree()));
  expect(latest.selectedPatientId).toBeNull();
});

test('selection survives re-renders for the same user', async () => {
  mockUseAuth.mockReturnValue({ userId: 7 });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(tree());
  });
  await ReactTestRenderer.act(async () => latest.setSelectedPatient(42, 'Asha'));
  await ReactTestRenderer.act(async () => renderer.update(tree()));
  expect(latest.selectedPatientId).toBe(42);
});
