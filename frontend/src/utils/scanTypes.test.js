import { describe, it, expect } from 'vitest'
import { sessionsOfType, comparableTypes, previousComparableSession, formatScanTypes } from './scanTypes'

const s = (id, scan_types) => ({ id, scan_types })

describe('sessionsOfType', () => {
  it('keeps matching and untagged scans, drops other types', () => {
    const sessions = [s(1, null), s(2, ['acne']), s(3, ['pigmentation']), s(4, ['acne', 'pigmentation']), s(5, [])]
    expect(sessionsOfType(sessions, 'acne').map((x) => x.id)).toEqual([1, 2, 4, 5])
    expect(sessionsOfType(sessions, 'pigmentation').map((x) => x.id)).toEqual([1, 3, 4, 5])
  })
})

describe('comparableTypes', () => {
  it('only offers types with at least two comparable scans', () => {
    expect(comparableTypes([s(1, ['acne']), s(2, ['acne']), s(3, ['pigmentation'])])).toEqual(['acne'])
  })

  it('treats all-untagged history as comparable under every type', () => {
    expect(comparableTypes([s(1, null), s(2, null)])).toEqual(['acne', 'pigmentation', 'wrinkle', 'pore'])
  })
})

describe('previousComparableSession', () => {
  it('skips earlier scans of a different type', () => {
    const sessions = [s(1, ['acne']), s(2, ['pigmentation']), s(3, ['acne'])]
    expect(previousComparableSession(sessions, 3).id).toBe(1)
  })

  it('matches on any shared type', () => {
    const sessions = [s(1, ['pigmentation']), s(2, ['acne', 'pigmentation'])]
    expect(previousComparableSession(sessions, 2).id).toBe(1)
  })

  it('pairs with an untagged earlier scan', () => {
    const sessions = [s(1, null), s(2, ['wrinkle'])]
    expect(previousComparableSession(sessions, 2).id).toBe(1)
  })

  it('returns null when nothing earlier shares a type', () => {
    expect(previousComparableSession([s(1, ['pore']), s(2, ['acne'])], 2)).toBeNull()
  })

  it('returns null when the current scan is not in the (stale) list yet', () => {
    expect(previousComparableSession([s(1, ['acne']), s(2, ['acne'])], 99)).toBeNull()
  })
})

describe('formatScanTypes', () => {
  it('uses display labels', () => {
    expect(formatScanTypes(['acne', 'wrinkle'])).toBe('Acne, Wrinkles')
  })
})
