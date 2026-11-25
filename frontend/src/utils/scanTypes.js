// What a scan was taken to track. Every scan is still scored for all four
// conditions; the type only decides which Before/After comparisons it joins,
// so an acne close-up is never paired with a pigmentation photo.
// Keep in sync with SCAN_TYPES in backend/app/api/routes/analysis.py.
export const SCAN_TYPES = ['acne', 'pigmentation', 'wrinkle', 'pore']

export const SCAN_TYPE_LABELS = {
  acne: 'Acne',
  pigmentation: 'Pigmentation',
  wrinkle: 'Wrinkles',
  pore: 'Pores',
}

// Scans saved before types existed have no scan_types; they count as every
// type so no history disappears from Before/After.
export function isUntagged(session) {
  return !session?.scan_types || session.scan_types.length === 0
}

export function sessionHasType(session, type) {
  return isUntagged(session) || session.scan_types.includes(type)
}

// Sessions (oldest-first, as the API returns them) comparable under `type`.
export function sessionsOfType(sessions, type) {
  return sessions.filter((s) => sessionHasType(s, type))
}

// Types worth offering as Before/After tabs: those with at least two
// comparable scans, in canonical order.
export function comparableTypes(sessions) {
  return SCAN_TYPES.filter((t) => sessionsOfType(sessions, t).length >= 2)
}

// The most recent scan before `currentId` that shares a type with it — the
// "before" for a just-finished scan. Returns null if `currentId` isn't in the
// list yet (e.g. a cached list fetched before this scan was saved) or there's
// no earlier comparable scan.
export function previousComparableSession(sessions, currentId) {
  const idx = sessions.findIndex((s) => s.id === currentId)
  if (idx <= 0) return null
  const current = sessions[idx]
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = sessions[i]
    if (isUntagged(current) || isUntagged(candidate)) return candidate
    if (candidate.scan_types.some((t) => current.scan_types.includes(t))) return candidate
  }
  return null
}

export function formatScanTypes(types) {
  return (types || []).map((t) => SCAN_TYPE_LABELS[t] || t).join(', ')
}
