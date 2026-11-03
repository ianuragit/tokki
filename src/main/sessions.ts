/**
 * Persistent session partitions, one per provider. Logins survive restarts
 * because Electron stores the cookies inside the app data folder.
 * Tokki never reads, exports, logs or transmits these cookies.
 */
import { session, type Session } from 'electron';
import type { ProviderId } from '../shared/types';
import { PROVIDER_META } from '../providers';

const configured = new Set<string>();

/** A regular-browser user agent (without "Electron/x" / "tokki/x"), which some login flows require. */
function cleanUserAgent(ua: string): string {
  return ua.replace(/\s(tokki|Tokki|Electron)\/\S+/g, '');
}

export function providerSession(id: ProviderId): Session {
  const partition = PROVIDER_META[id].partition;
  const ses = session.fromPartition(partition);
  if (!configured.has(partition)) {
    configured.add(partition);
    ses.setUserAgent(cleanUserAgent(ses.getUserAgent()));
    // Deny permission prompts (notifications, mic, camera…) from the web apps.
    ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'));
  }
  return ses;
}
