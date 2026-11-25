import { sessionsOfType, comparableTypes, previousComparableSession } from '../src/utils/scanTypes';

const s = (id: number, scan_types: string[] | null) => ({ id, scan_types });

test('sessionsOfType keeps matching and untagged scans only', () => {
  const sessions = [s(1, null), s(2, ['acne']), s(3, ['pigmentation']), s(4, ['acne', 'pigmentation'])];
  expect(sessionsOfType(sessions, 'acne').map((x) => x.id)).toEqual([1, 2, 4]);
});

test('comparableTypes needs two comparable scans', () => {
  expect(comparableTypes([s(1, ['acne']), s(2, ['acne']), s(3, ['pore'])])).toEqual(['acne']);
});

test('previousComparableSession skips other types and handles stale lists', () => {
  const sessions = [s(1, ['acne']), s(2, ['pigmentation']), s(3, ['acne'])];
  expect(previousComparableSession(sessions, 3)?.id).toBe(1);
  expect(previousComparableSession(sessions, 99)).toBeNull();
  expect(previousComparableSession([s(1, ['pore']), s(2, ['acne'])], 2)).toBeNull();
});
