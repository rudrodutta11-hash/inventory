import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta, setMeta } from '../lib/meta';
import { db } from '../db';
import { importData, type BackupFile } from '../lib/backup';
import { clearAll } from '../lib/seed';
import { checkRemote } from '../lib/sync';
import { timeAgo } from '../lib/format';
import ConfirmDialog from './ConfirmDialog';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * iOS install banner: home-screen install is a data-durability feature —
 * installed web apps are exempt from Safari's 7-day storage eviction.
 */
export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void (async () => {
      const dismissed = await getMeta<boolean>('installBannerDismissed');
      if (!dismissed && isIos() && !isStandalone()) setShow(true);
    })();
  }, []);

  if (!show) return null;
  return (
    <div className="banner no-print">
      <div>
        <strong>Install to keep your data safe.</strong>{' '}
        {expanded ? (
          <span className="small soft">
            In Safari, tap Share, then "Add to Home Screen". Installed apps are exempt
            from Safari's 7-day storage clearing; a browser tab is not.
          </span>
        ) : (
          <button className="btn btn--quiet" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => setExpanded(true)}>
            How
          </button>
        )}
      </div>
      <button
        className="btn btn--quiet"
        aria-label="Dismiss install banner"
        onClick={() => { setShow(false); void setMeta('installBannerDismissed', true); }}
      >
        Dismiss
      </button>
    </div>
  );
}

/** Backup nag after 20 edits without an export. */
export function BackupBanner({ onExport }: { onExport: () => void }) {
  const edits = useLiveQuery(async () => (await getMeta<number>('editsSinceBackup')) ?? 0, [], 0);
  const [dismissedAt, setDismissedAt] = useState(0);

  if (edits === undefined || edits < 20 || dismissedAt >= edits) return null;
  return (
    <div className="banner no-print">
      <span>{edits} changes since your last backup.</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={onExport}>Back up</button>
        <button className="btn btn--quiet" aria-label="Dismiss backup reminder" onClick={() => setDismissedAt(edits)}>Later</button>
      </span>
    </div>
  );
}

/**
 * First run: three lines that matter, on an empty cabinet only.
 * Not a wizard — one dismissible card, dismissal kept in meta.
 */
export function FirstRunCard() {
  const dismissed = useLiveQuery(async () => (await getMeta<boolean>('firstRunDismissed')) ?? false, [], undefined);
  const [showInstall, setShowInstall] = useState(false);

  if (dismissed === undefined || dismissed) return null;
  return (
    <div className="first-run no-print">
      <h2 className="display">Three things and you're set</h2>
      <ol>
        <li>
          <strong>Add your first bottle.</strong> Only the name is required —
          everything else is optional.
        </li>
        <li>
          <strong>Install this to your home screen.</strong>{' '}
          {isStandalone()
            ? 'Done — you are running the installed app.'
            : 'It then works without a signal and keeps your records safe.'}
          {!isStandalone() && (
            <>
              {' '}
              <button className="linklike" onClick={() => setShowInstall((v) => !v)}>
                {showInstall ? 'Hide' : 'How'}
              </button>
              {showInstall && (
                <span className="small soft"> In Safari, tap Share, then "Add to Home Screen".</span>
              )}
            </>
          )}
        </li>
        <li>
          <strong>Back up now and then.</strong> Settings, Back up, Save to Files.
          Your bottles live on this phone only.
        </li>
      </ol>
      <button className="btn btn--quiet" onClick={() => void setMeta('firstRunDismissed', true)}>
        Got it
      </button>
    </div>
  );
}

/**
 * Demo data is made up. Say so, everywhere, until it is cleared —
 * it must never be mistaken for the real cabinet.
 */
export function DemoBanner() {
  const demo = useLiveQuery(async () => (await getMeta<boolean>('demoLoaded')) ?? false, [], false);
  const [confirming, setConfirming] = useState(false);
  if (!demo) return null;
  return (
    <>
      <div className="banner banner--demo no-print">
        <span>
          <strong>Demo data.</strong> These bottles are made up, for looking around.
        </span>
        <button className="btn" onClick={() => setConfirming(true)}>Clear it</button>
      </div>
      <ConfirmDialog
        open={confirming}
        confirmLabel="Clear demo data"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => void clearAll().then(() => setConfirming(false))}
      >
        <p>Remove the demo bottles and start your real cabinet from empty?</p>
      </ConfirmDialog>
    </>
  );
}

/** On app open: offer to restore a newer remote backup. Never auto-overwrites. */
export function RemoteRestoreBanner() {
  const [remote, setRemote] = useState<{ remote: BackupFile; remoteAt: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bottleCount = useLiveQuery(() => db.bottles.count(), [], 0);

  useEffect(() => {
    void checkRemote().then(setRemote);
  }, []);

  if (!remote) return null;
  return (
    <>
      <div className="banner no-print">
        <span>A newer backup exists ({timeAgo(remote.remoteAt)}). Restore it?</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setConfirming(true)}>Restore</button>
          <button className="btn btn--quiet" aria-label="Dismiss restore offer" onClick={() => setRemote(null)}>Not now</button>
        </span>
      </div>
      <ConfirmDialog
        open={confirming}
        confirmLabel="Restore backup"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void importData(remote.remote).then(() => {
            setConfirming(false);
            setRemote(null);
          });
        }}
      >
        <p>
          Restoring replaces all {bottleCount ?? 0} bottles currently on this phone with
          the backup from {timeAgo(remote.remoteAt)} ({remote.remote.bottles.length} bottles).
        </p>
      </ConfirmDialog>
    </>
  );
}
