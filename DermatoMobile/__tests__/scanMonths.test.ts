import { buildScanPickerItems } from '../src/utils/scanMonths';

// Mid-month, midday UTC so the local month is the same in any test timezone.
const s = (id: number, date: string) => ({ id, captured_at: `${date}T12:00:00Z` });

const shape = (items: ReturnType<typeof buildScanPickerItems>) =>
  items.map((it) => (it.kind === 'month' ? 'M' : it.index));

test('lists scans newest first with one header per month', () => {
  const sessions = [s(1, '2026-09-12'), s(2, '2026-09-15'), s(3, '2026-10-14'), s(4, '2026-11-16'), s(5, '2026-11-18')];
  expect(shape(buildScanPickerItems(sessions))).toEqual(['M', 4, 3, 'M', 2, 'M', 1, 0]);
});

test('keeps the original index even when input is out of order', () => {
  const sessions = [s(1, '2026-11-16'), s(2, '2026-09-12'), s(3, '2026-11-14')];
  const items = buildScanPickerItems(sessions);
  expect(shape(items)).toEqual(['M', 0, 2, 'M', 1]);
  expect(items.filter((it) => it.kind === 'month')).toHaveLength(2);
});

test('the same month in different years gets separate headers', () => {
  const items = buildScanPickerItems([s(1, '2025-11-15'), s(2, '2026-11-15')]);
  const titles = items.flatMap((it) => (it.kind === 'month' ? [it.title] : []));
  expect(titles).toHaveLength(2);
  expect(titles[0]).toMatch(/2026/);
  expect(titles[1]).toMatch(/2025/);
});

test('empty input gives no rows', () => {
  expect(buildScanPickerItems([])).toEqual([]);
});
