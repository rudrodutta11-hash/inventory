import { bumpEditsSinceBackup } from './meta';
import { scheduleSync } from './sync';

/**
 * Call after every user-visible data mutation: counts edits toward the
 * backup nag and schedules the (optional) off-device sync push.
 */
export async function afterMutation(): Promise<void> {
  try {
    await bumpEditsSinceBackup();
  } catch {
    // never let bookkeeping break the actual edit
  }
  scheduleSync();
}
