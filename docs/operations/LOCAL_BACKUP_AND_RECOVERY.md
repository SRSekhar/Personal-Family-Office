# Local Backup and Recovery Guide

This guide applies to the local-first PFO OS dashboard and its SQLite workspace. It is an operational recommendation, not an automated backup or retention service.

## Understand the two local copies

- **Browser workspace:** The dashboard keeps the current private workspace in browser-local storage. This is the immediate working/recovery copy, but it is tied to that browser profile and device.
- **SQLite workspace:** The loopback dashboard server stores the last committed complete schema-v4 snapshot. Automatic SQLite saves are opt-in and debounced; they are persistence, not an independent backup.
- **Portable JSON export:** The dashboard's SQLite backup export downloads the last committed SQLite snapshot. It does not include browser edits that have not yet reached SQLite. The export contains all five collections: financial records, goals, cash-flow entries, budgets, and historical snapshots.

A database integrity check is useful for detecting structural problems, but a successful `PRAGMA quick_check` does not prove that a backup can be restored or that financial values are correct.

## Recommended backup cadence

For a household workspace that changes regularly:

1. Export a portable JSON backup **at least weekly**.
2. Export another backup immediately after a material change, such as a major import, correction, new historical snapshot, or large batch of edits.
3. Before a planned device migration, operating-system reinstall, browser-profile reset, or database-path change, export and verify a fresh backup.
4. Keep at least **two independent copies**: one on the primary device and one on a separate, access-controlled storage location. A second copy on the same physical disk is not independent protection.

These are conservative operating recommendations, not enforced application settings. Increase frequency if the data changes more often or the cost of re-entry is high.

## Retention and storage

A practical manual starting policy is:

- Keep the latest four weekly exports.
- Keep one month-end export for each of the last twelve months.
- Keep milestone exports before migrations or major data corrections until the migration/correction has been verified.
- Periodically test an older retained export before deleting it.

Use a clearly named private folder and retain the original downloaded filenames or add an unambiguous date. Do not store real exports in this public Git repository, issue trackers, chat transcripts, or unencrypted shared folders.

PFO OS JSON exports are **not encrypted**. Store them only on storage protected by full-disk/device encryption and appropriate account access controls. If moving them to removable media or a cloud-storage provider, enable that provider/device's encryption and multi-factor authentication where available. PFO OS does not upload, encrypt, rotate, or delete backups for you.

Do not rely on a single copy, a sync folder alone, or the SQLite database file alone as your disaster-recovery plan.

## Create a portable backup

1. Start the local dashboard with `pnpm dashboard:serve`.
2. Open the loopback address printed by the server (normally `http://127.0.0.1:4173/`).
3. Switch to **Use my data** and confirm the expected household workspace is visible.
4. If using SQLite, ensure the latest edits have completed their save. For automatic mode, wait until the save status indicates completion; otherwise use the explicit **Save private workspace to SQLite** action.
5. Use the dashboard's portable SQLite JSON backup export action.
6. Save the downloaded JSON file to the private backup folder and copy it to the independent protected location.
7. Record the export date and, if useful, a short note describing the milestone. Do not put personal financial details in the filename.

The portable export represents the last committed SQLite snapshot, not unsaved browser-local edits. If SQLite has never been saved, first save the workspace.

## Recovery procedures

### Restore on the same device from SQLite

1. Start the local dashboard and review the workspace currently shown.
2. If possible, create a portable JSON export of the current committed SQLite snapshot before replacing anything.
3. Run **Check database integrity**. If it fails, do not treat the database as trustworthy; preserve the database file and use a known-good portable export instead.
4. Use **Restore from SQLite** and carefully review the preview, including record counts and the presence/counts of goals, cash-flow entries, budgets, and historical snapshots.
5. Confirm only when the preview represents the intended snapshot.
6. After restore, inspect key balances, recent transactions, goals, budgets, and historical snapshot dates. Run the integrity check again.

### Restore from a portable JSON export

1. Start the local dashboard on the destination device and switch to **Use my data**.
2. Keep a separate copy of the current workspace/database before importing if it contains anything that may need to be recovered.
3. Use the dashboard's JSON backup import action and select the intended dated export.
4. Review the validated preview, currency, schema, and collection counts before confirming.
5. After import, inspect important balances and selected historical records. Save the restored workspace to SQLite so the new device has a committed local snapshot.
6. Export a fresh backup from the destination device and retain it as the new recovery point.

If an import is rejected, do not attempt to edit the backup manually or repeatedly overwrite the current workspace. Preserve the rejected file for diagnosis and use another known-good export. Validation and restore rollback are designed to reject invalid payloads without replacing the prior workspace; still verify the visible data and SQLite snapshot after any failed attempt.

## Device migration checklist

- [ ] Export a fresh portable JSON backup.
- [ ] Copy it to a separate protected location.
- [ ] Confirm the destination device has Node.js 22.x and the repository/dashboard setup.
- [ ] Start the local dashboard on the destination.
- [ ] Import the JSON backup and review the preview before confirming.
- [ ] Inspect all five collections and important financial values.
- [ ] Save the restored workspace to the destination SQLite database.
- [ ] Run the database integrity check.
- [ ] Export and retain a fresh destination backup.
- [ ] Only then retire or wipe the old device/profile/database.

## Important limitations

- SQLite database files and portable JSON exports are not encrypted by this feature.
- The local SQLite database defaults outside the repository; it is not a cloud backup or multi-device synchronization service.
- Browser-local storage is tied to the browser profile and can be lost when that profile is cleared.
- Automatic SQLite saves do not create historical backup generations.
- PFO OS does not currently implement automatic backup rotation, retention enforcement, remote backup, or a scheduled restore drill.
- A valid structure does not guarantee financial correctness. Review restored values against trusted source records.

