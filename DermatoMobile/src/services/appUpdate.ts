// In-app update check. Sideloaded APKs get no Play Store updates, so on launch
// (and when the app returns to the foreground) the app asks the backend for
// the newest GitHub release and offers it. Android always asks the user to
// confirm installing an APK, so this can prompt and download, never update
// silently.
import { version as packageVersion } from '../../package.json';
import type { AppVersionInfo } from '../api/client';

// Same field android/app/build.gradle derives versionName/versionCode from.
export const APP_VERSION: string = packageVersion;

type Version = [number, number, number];

export function parseVersion(text: string | null | undefined): Version | null {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec((text ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

// <0 if a is older than b, 0 if equal, >0 if newer. Unparseable versions
// compare as equal, so a bad value never triggers a prompt.
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

export type UpdateDecision =
  | { kind: 'none' }
  | { kind: 'optional' | 'required'; latestVersion: string; downloadUrl: string; releaseUrl: string | null };

export function decideUpdate(info: AppVersionInfo | null, current: string = APP_VERSION): UpdateDecision {
  if (!info?.latest_version || !info.download_url) return { kind: 'none' };
  if (compareVersions(current, info.latest_version) >= 0) return { kind: 'none' };
  const required = !!info.min_supported_version && compareVersions(current, info.min_supported_version) < 0;
  return {
    kind: required ? 'required' : 'optional',
    latestVersion: info.latest_version,
    downloadUrl: info.download_url,
    releaseUrl: info.release_url,
  };
}

// "Later" hides the prompt for that version for this long; a newer release
// shows up again right away.
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

export function isSnoozed(
  snooze: { version: string; until: number } | null,
  latestVersion: string,
  now: number = Date.now()
): boolean {
  return !!snooze && snooze.version === latestVersion && now < snooze.until;
}
