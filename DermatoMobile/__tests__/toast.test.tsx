import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ToastProvider, useToast } from '../src/context/ToastContext';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const seen: ReturnType<typeof useToast>[] = [];
function Probe() {
  seen.push(useToast());
  return null;
}

// Screens list `toast` as a hook dependency (e.g. the Worklist's load()). If
// showing a toast changed its identity, an error toast inside such a load
// would re-trigger the load -> fail -> toast again, in a loop.
test('toast keeps one identity when a toast is shown', async () => {
  jest.useFakeTimers();
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
  });
  const first = seen[seen.length - 1];
  await ReactTestRenderer.act(async () => first.error('Network down'));
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(seen.length).toBeGreaterThan(0);
  for (const t of seen) expect(t).toBe(first);
  jest.useRealTimers();
});
