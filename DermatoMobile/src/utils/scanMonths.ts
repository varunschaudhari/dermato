// Rows for the Before/After scan picker: newest first, with a header row
// opening each calendar month. Kept as one flat list (rather than SectionList
// sections) so every row has a fixed height and the sheet can open already
// scrolled to the selected scan.
type Dated = { id: number; captured_at: string };

export type ScanPickerItem<T> =
  | { kind: 'month'; key: string; title: string }
  // `index` is the scan's position in the input list, which is what the
  // Before/After selection state stores.
  | { kind: 'scan'; key: string; session: T; index: number };

export function buildScanPickerItems<T extends Dated>(sessions: T[]): ScanPickerItem<T>[] {
  // Sort rather than just reverse, so a list that isn't strictly oldest-first
  // can't split one month into two headers.
  const order = sessions
    .map((_, i) => i)
    .sort((a, b) => Date.parse(sessions[b].captured_at) - Date.parse(sessions[a].captured_at) || b - a);

  const items: ScanPickerItem<T>[] = [];
  let lastMonth: string | null = null;
  for (const index of order) {
    const session = sessions[index];
    const d = new Date(session.captured_at);
    const month = `${d.getFullYear()}-${d.getMonth()}`;
    if (month !== lastMonth) {
      items.push({ kind: 'month', key: `m${month}`, title: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) });
      lastMonth = month;
    }
    items.push({ kind: 'scan', key: `s${session.id}`, session, index });
  }
  return items;
}
