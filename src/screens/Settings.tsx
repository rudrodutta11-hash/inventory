import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { db } from '../db';
import { getMeta, setMeta } from '../lib/meta';
import { shareBackup, importData, validateBackup, type BackupFile } from '../lib/backup';
import { ensureSyncKey, syncNow, type SyncStatus } from '../lib/sync';
import { seedDemo, clearAll } from '../lib/seed';
import { fmtBytes, timeAgo } from '../lib/format';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settings() {
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [syncKey, setSyncKey] = useState('');
  const [syncKeyQr, setSyncKeyQr] = useState('');
  const [syncUrl, setSyncUrlState] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const theme = useLiveQuery(async () => (await getMeta<string>('theme')) ?? 'light', [], 'light');
  const lastBackupAt = useLiveQuery(() => getMeta<string>('lastBackupAt'), []);
  const lastSyncAt = useLiveQuery(() => getMeta<string>('lastSyncAt'), []);
  const syncStatus = useLiveQuery(async () => (await getMeta<SyncStatus>('syncStatus')) ?? 'off', [], 'off' as SyncStatus);
  const bottleCount = useLiveQuery(() => db.bottles.count(), [], 0);

  useEffect(() => {
    void navigator.storage?.estimate?.().then(setEstimate);
    void navigator.storage?.persisted?.().then(setPersisted);
    void ensureSyncKey().then((key) => {
      setSyncKey(key);
      void QRCode.toDataURL(key, { margin: 1, width: 160 }).then(setSyncKeyQr);
    });
    void getMeta<string>('syncUrl').then((u) => setSyncUrlState(u ?? ''));
  }, []);

  async function saveSyncUrl(value: string) {
    setSyncUrlState(value);
    const trimmed = value.trim();
    await setMeta('syncUrl', trimmed || undefined);
    if (!trimmed) await setMeta('syncStatus', 'off' satisfies SyncStatus);
  }

  async function onImportFile(file: File) {
    setImportError('');
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateBackup(parsed)) {
        setImportError('That file is not a Cabinet backup, or it is from a newer version of the app.');
        return;
      }
      setPendingImport(parsed);
    } catch {
      setImportError('Could not read that file. It should be a cabinet-YYYY-MM-DD.json export.');
    }
  }

  const syncLine =
    syncStatus === 'off' || !syncUrl.trim()
      ? 'Sync off'
      : syncStatus === 'failing'
        ? `Sync failing${lastSyncAt ? ` · last synced ${timeAgo(lastSyncAt)}` : ''}`
        : lastSyncAt
          ? `Last synced ${timeAgo(lastSyncAt)}`
          : 'Sync on · nothing pushed yet';

  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 16 }}>Settings</h1>

      <section className="section" style={{ marginTop: 0 }}>
        <div className="section-head">Theme</div>
        <div className="choice-row">
          <button className="btn" aria-pressed={theme === 'light'} onClick={() => void setMeta('theme', 'light')}>Ledger</button>
          <button className="btn" aria-pressed={theme === 'cellar'} onClick={() => void setMeta('theme', 'cellar')}>Cellar</button>
        </div>
        <p className="small soft" style={{ marginTop: 8 }}>Cellar is the dark one, for dim rooms.</p>
      </section>

      <section className="section">
        <div className="section-head">Backup</div>
        <p className="small soft" style={{ marginBottom: 12 }}>
          Everything lives on this phone. A backup is one file with every bottle, pour, note and photo in it.
          {lastBackupAt ? ` Last backup ${timeAgo(lastBackupAt)}.` : ' No backup taken yet.'}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn--primary btn--full" onClick={() => void shareBackup()}>
            Export backup
          </button>
          <button className="btn btn--full" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {importError && (
          <p className="small" style={{ borderLeft: '3px solid var(--stencil)', paddingLeft: 8, marginTop: 8 }} role="alert">
            {importError}
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-head">Storage</div>
        <div className="kv-line">
          <span className="k">Storage used</span>
          <span className="v">
            {estimate?.usage !== undefined
              ? `${fmtBytes(estimate.usage)} of ${fmtBytes(estimate.quota ?? 0)}`
              : 'Unknown'}
          </span>
        </div>
        <div className="kv-line">
          <span className="k">Protected from eviction</span>
          <span className="v">{persisted === null ? 'Unknown' : persisted ? 'Yes' : 'Not granted'}</span>
        </div>
        {persisted === false && (
          <p className="small soft">
            The browser has not granted persistent storage. Installing the app to the
            home screen is the reliable fix on iPhone.
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-head">Sync</div>
        <p className="small soft" style={{ marginBottom: 12 }}>
          Optional. Deploy the tiny worker from the project's worker folder, paste its
          address here, and every change is copied off the phone a few seconds later.
        </p>
        <div className="field">
          <label htmlFor="sync-url">Worker address</label>
          <input
            id="sync-url"
            type="url"
            placeholder="https://cabinet-sync.example.workers.dev"
            value={syncUrl}
            onChange={(e) => void saveSyncUrl(e.target.value)}
          />
        </div>
        <div className="kv-line">
          <span className="k">Status</span>
          <span className="v">{syncLine}</span>
        </div>
        {syncUrl.trim() && (
          <button
            className="btn btn--full"
            style={{ marginTop: 8 }}
            onClick={() => {
              setSyncMsg('');
              void syncNow()
                .then(() => setSyncMsg('Synced.'))
                .catch(() => setSyncMsg('Could not reach the worker. Check the address.'));
            }}
          >
            Sync now
          </button>
        )}
        {syncMsg && <p className="small soft" style={{ marginTop: 8 }} role="status">{syncMsg}</p>}

        <details className="fold" style={{ marginTop: 16 }}>
          <summary>Sync key — for moving to a new phone</summary>
          <div style={{ padding: '8px 0' }}>
            <p className="small soft" style={{ marginBottom: 8 }}>
              The key names your backup on the worker. On a new phone, enter the same
              worker address and this key, and restore.
            </p>
            <p className="sync-key">{syncKey || '…'}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <button
                className="btn btn--quiet"
                onClick={() => {
                  void navigator.clipboard?.writeText(syncKey).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? 'Copied' : 'Copy key'}
              </button>
              {syncKeyQr && <img src={syncKeyQr} alt="QR code of the sync key" width={80} height={80} />}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="sync-key-input">Replace key (paste the old phone's key here)</label>
              <input
                id="sync-key-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={syncKey}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setSyncKey(v);
                  void setMeta('syncKey', v);
                  void QRCode.toDataURL(v || '-', { margin: 1, width: 160 }).then(setSyncKeyQr);
                }}
              />
            </div>
          </div>
        </details>
      </section>

      <section className="section">
        <div className="section-head">Demo data</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => void seedDemo()}>
            Load demo cabinet
          </button>
          <button className="btn btn--danger" style={{ flex: 1 }} onClick={() => setConfirmClear(true)}>
            Clear all data
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={pendingImport !== null}
        confirmLabel="Replace everything"
        danger
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (!pendingImport) return;
          void importData(pendingImport).then(() => setPendingImport(null));
        }}
      >
        <p>
          This replaces all {bottleCount} {bottleCount === 1 ? 'bottle' : 'bottles'} currently on
          this phone with the {pendingImport?.bottles.length ?? 0} in the backup file,
          including every pour, note and photo. There is no merge.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClear}
        confirmLabel="Clear everything"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void clearAll().then(() => setConfirmClear(false))}
      >
        <p>Remove all {bottleCount} {bottleCount === 1 ? 'bottle' : 'bottles'}, pours, notes and photos from this phone? Export a backup first if in doubt.</p>
      </ConfirmDialog>
    </div>
  );
}
