# Module — Backup & Restore

## 1. Purpose

The Backup module protects the mill's data against hardware failure, accidental deletion, and OS corruption. All business data lives in a single SQLite file. This is both the simplicity of the system and its single point of failure — robust backup and validated restore are therefore non-negotiable features, not nice-to-haves.

**Silent backup failure is treated as a critical defect.** If a backup fails, the operator must be told.

---

## 2. Functional Requirements

| ID | Requirement |
|---|---|
| FR-BKP-01 | Automatic backup runs on a configurable schedule (default: daily) to a configurable destination. |
| FR-BKP-02 | A one-click "Backup Now" action is available from the Settings page and the Dashboard. |
| FR-BKP-03 | The system retains a configurable number of backups (default: 14 daily + 8 weekly) and prunes older ones automatically. |
| FR-BKP-04 | Before restoring, the system verifies backup file integrity (checksum + schema version), shows a summary, and requires explicit confirmation. The live database is safety-copied before overwrite. |
| FR-BKP-05 | A failed backup raises a persistent, dismiss-requiring notification. |

---

## 3. Backup Method

SQLite's **Online Backup API** is used via `better-sqlite3`'s `database.backup()` method. This allows a consistent, non-blocking backup of the live database while the app is actively in use — no need to close the app or pause operations.

```typescript
// infrastructure/backup.ts

import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

async function createBackup(config: BackupConfig): Promise<BackupResult> {
  const db = getDbConnection();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName  = `badachuli-backup-${timestamp}.sqlite`;
  const destPath  = path.join(config.destination, fileName);

  try {
    await db.backup(destPath);  // SQLite Online Backup API — non-blocking
    const checksum = computeSHA256(destPath);

    await backupRepo.insert({
      destination:  config.destination,
      file_name:    fileName,
      file_size_kb: Math.round(fs.statSync(destPath).size / 1024),
      checksum,
      trigger_type: config.triggerType,
      status:       'success',
    });

    return { ok: true, path: destPath, checksum };
  } catch (err) {
    await backupRepo.insert({ ..., status: 'failed', error_msg: String(err) });
    notifyOperator('BACKUP_FAILED', String(err));  // persistent UI notification
    return { ok: false, error: String(err) };
  }
}

function computeSHA256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}
```

---

## 4. Backup Destinations

| Type | How It Works | Notes |
|---|---|---|
| **Local folder** | A folder on the same machine (e.g., `C:\BadachuliBackups\`) | Fast; vulnerable to same hardware failure as live DB — use as secondary |
| **USB / External drive** | A removable drive path (e.g., `E:\Backup\`) | Best protection against PC failure; operator must plug in the drive |
| **Cloud-synced folder** | A folder managed by Google Drive, OneDrive, or Dropbox | The system writes to the local sync folder; the cloud app syncs it offsite automatically |

**Recommended configuration:** USB drive as primary, cloud-synced folder as secondary. Both can be set simultaneously — the system runs backup to each destination in sequence.

---

## 5. Backup Schedule

| Trigger | Default | Configurable? |
|---|---|---|
| Daily automatic backup | 11:00 PM every day | Yes — time and frequency |
| Weekly automatic backup | Every Sunday | Yes |
| Pre-update backup | Before any app update installs | No — always on |
| Manual "Backup Now" | Operator triggered | N/A |

The schedule is implemented using Electron's main process timer (not a cron daemon). If the app is not running at the scheduled time, the backup runs on next app startup if the last backup is older than the schedule interval.

---

## 6. Retention Policy

Default retention: **14 daily backups + 8 weekly backups**.

The pruning logic runs after every successful backup:
1. List all backup files in the destination, sorted by date.
2. Keep the 14 most recent daily backups.
3. Keep the 8 most recent Sunday backups (regardless of whether they are in the daily 14).
4. Delete the rest.
5. Update the `backups` table to mark deleted entries.

```typescript
function pruneBackups(destination: string, config: RetentionConfig): void {
  const files = backupRepo.listByDestination(destination);
  const daily  = files.filter(f => f.trigger_type !== 'weekly').slice(config.retain_daily);
  const weekly = files.filter(f => f.trigger_type === 'weekly').slice(config.retain_weekly);
  [...daily, ...weekly].forEach(f => {
    fs.unlinkSync(f.path);
    backupRepo.markDeleted(f.id);
  });
}
```

---

## 7. Validated Restore Flow

```
Settings → Backup & Restore → Restore from Backup
    │
    ▼
File picker: select .sqlite backup file
    │
    ▼
Validation:
    ├── SHA-256 checksum of selected file
    ├── Compare with stored checksum in backups table
    ├── Open backup file and check SQLite user_version (schema version)
    └── If checks pass: show summary
           (backup date/time, bill count, last transaction, file size)
    │
    ▼
Warning dialog:
  "This will REPLACE the current database.
   Your current data will be safety-copied first.
   This cannot be undone. Type RESTORE to confirm."
    │
    ▼ (operator types RESTORE)
    │
    ├── 1. Safety-copy current DB to: badachuli-pre-restore-<timestamp>.sqlite
    ├── 2. Copy backup file to the live DB path
    ├── 3. Reload DB connection
    └── 4. Write audit_log entry: RESTORE_PERFORMED (who, when, from which backup)
    │
    ▼
"Restore complete. Application will restart."
→ Electron app reloads
```

If any step fails before step 2, the live DB is untouched. If step 2–3 fails, the safety copy is available for manual recovery.

---

## 8. Backup Failure Notification

A failed automatic backup triggers a **persistent notification bar** that appears at the top of every screen until the operator acknowledges it:

```
⚠ Last automatic backup FAILED on 2081-05-12 at 11:00 PM
   Reason: Destination folder not found (E:\Backup\)
   [Retry Now]  [Change Backup Destination]  [Dismiss]
```

"Dismiss" removes the bar for that failure only. The next scheduled backup that fails will show it again. The operator cannot accidentally ignore backup failures indefinitely — the bar re-appears on every app restart until the underlying issue is fixed or a successful backup runs.

---

## 9. Security

- Backup files are plain SQLite files by default. If the live database is encrypted with SQLCipher (optional feature), backup files inherit the same encryption.
- Backup files written to cloud-synced folders should be clearly noted in the UI as "leaving this device" so the operator is aware of the data leaving the local machine.
- Backup files stored on USB drives are unencrypted unless DB encryption is enabled — the operator is responsible for physical security of the drive.

---

## 10. Business Rules

1. **Backup failure is not silent.** Any backup failure produces a persistent UI notification and a `backups` row with `status = 'failed'`.
2. **Restore requires explicit typed confirmation.** Accidental clicks cannot trigger a restore.
3. **The live DB is safety-copied before every restore.** No restore operation can result in total data loss.
4. **Backup integrity is verified before restore.** A corrupted or incompatible backup file is rejected before any changes are made to the live DB.
5. **Pre-update backup always runs.** Before any application auto-update installs, a backup is made regardless of the regular schedule.
