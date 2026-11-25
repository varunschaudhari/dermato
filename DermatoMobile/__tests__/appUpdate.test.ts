import { APP_VERSION, compareVersions, decideUpdate, isSnoozed, parseVersion } from '../src/services/appUpdate';
import type { AppVersionInfo } from '../src/api/client';

const info = (overrides: Partial<AppVersionInfo> = {}): AppVersionInfo => ({
  platform: 'android',
  latest_version: '1.4.0',
  download_url: 'https://example.test/dermato.apk',
  release_url: 'https://example.test/releases/v1.4.0',
  release_name: 'Dermato 1.4',
  min_supported_version: null,
  ...overrides,
});

test('APP_VERSION comes from package.json', () => {
  expect(parseVersion(APP_VERSION)).not.toBeNull();
});

test('compareVersions is numeric, not lexical', () => {
  expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
  expect(compareVersions('v1.2', '1.2.0')).toBe(0);
  expect(compareVersions('1.3.0', '1.3.1')).toBeLessThan(0);
  expect(compareVersions('garbage', '1.0.0')).toBe(0);
});

test('no prompt when up to date, ahead, or the server has nothing', () => {
  expect(decideUpdate(info({ latest_version: '1.3.0' }), '1.3.0').kind).toBe('none');
  expect(decideUpdate(info({ latest_version: '1.2.0' }), '1.3.0').kind).toBe('none');
  expect(decideUpdate(info({ latest_version: null, download_url: null }), '1.3.0').kind).toBe('none');
  expect(decideUpdate(null, '1.3.0').kind).toBe('none');
});

test('optional update when a newer release exists', () => {
  const d = decideUpdate(info(), '1.3.0');
  expect(d).toEqual({
    kind: 'optional',
    latestVersion: '1.4.0',
    downloadUrl: 'https://example.test/dermato.apk',
    releaseUrl: 'https://example.test/releases/v1.4.0',
  });
});

test('required update when below the minimum supported version', () => {
  expect(decideUpdate(info({ min_supported_version: '1.4.0' }), '1.3.0').kind).toBe('required');
  expect(decideUpdate(info({ min_supported_version: '1.3.0' }), '1.3.0').kind).toBe('optional');
});

test('snooze only applies to the same version and expires', () => {
  const now = 1_000_000;
  expect(isSnoozed({ version: '1.4.0', until: now + 1 }, '1.4.0', now)).toBe(true);
  expect(isSnoozed({ version: '1.4.0', until: now - 1 }, '1.4.0', now)).toBe(false);
  expect(isSnoozed({ version: '1.4.0', until: now + 1 }, '1.5.0', now)).toBe(false);
  expect(isSnoozed(null, '1.4.0', now)).toBe(false);
});
