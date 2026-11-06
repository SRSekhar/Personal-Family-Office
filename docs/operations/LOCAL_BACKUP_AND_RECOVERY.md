# Local Backup and Recovery Guide

This guide applies to the local-first PFO OS dashboard and its schema-v6 SQLite workspace. It documents the current manual backup/recovery workflow; it is not an automated backup or retention service.

## Understand the copies

- **Browser workspace:** The dashboard's private workspace in browser-local storage. It is the immediate working copy and remains available when SQLite autosave is delayed or fails, but it is tied to that browser profile and device.
- **SQLite workspace:** The local dashboard server's last committed complete schema-v6 snapshot. It contains 13 collections: financial records, goals, cash-flow entries, budgets, historical snapshots, investment accounts, investment instruments, investment transactions, investment valuations, investment cash accounts, investment cash movements, investment cash transfers, and investment cash statements.
- **Portable JSON export:** A validated, versioned full-workspace snapshot downloaded from the dashboard's SQLite backup/export action. It represents the last committed SQLite snapshot, not browser edits that have not yet reached SQLite. It is the portable recovery format; CSV interchange is not a replacement.

SQLite saves are opt-in and debounced when automatic mode is enabled. Transient save failures receive bounded retries, but retries can be exhausted. A successful SQLite integrity check does not prove that a backup can be restored or that financial values are correct.

## Recommended backup cadence

For a workspace that changes regularly:

1. Export a portable JSON backup at least weekly.
2. Export another backup immediately after a material change, such as a major import, correction, new historical snapshot, or large batch of edits.
3. Before a device migration, OS reinstall, browser-profile reset, or database-path change, export and verify a fresh backup.
4. Keep at least two independent copies: one on the primary device and one on separate, access-controlled storage.

These are manual recommendations, not enforced application settings. Increase frequency if data changes more often or the cost of re-entry is high.

## Retention and security

A practical manual starting policy is:
- Keep the latest four weekly exports.
- Keep one month-end export for each of the last twelve months.
- Keep milestone exports before migrations or major corrections until the change is verified.
- Periodically test an older retained export before deleting it.

Do not store real exports in this public Git repository, issue trackers, chat transcripts, or unencrypted shared folders. PFO OS JSON exports and the SQLite database are not encrypted by this feature. Protect them with device/full-disk encryption and appropriate account access controls. PFO OS does not upload, encrypt, rotate, or delete backups for you.

The SQLite database uses WAL journaling. Do not copy only the live `.sqlite` file while the server is running. Use **Create verified SQLite file backup** to create an online snapshot through Node's SQLite backup API. The server writes a unique file under `<database path>.backups`, verifies SQLite integrity and the complete schema-v6 payload, flushes the file, and only then publishes it. Existing backup files are never overwritten. This is a manual action; scheduling, rotation, retention enforcement, encryption and remote copy are not provided. Continue to create portable JSON exports as an independent backup format.

## Create a portable backup

1. Start the local dashboard with `pnpm dashboard:serve`.
2. Open the loopback address printed by the server (normally `http://127.0.0.1:4173/`).
3. Switch to **Use my data** and confirm the expected private workspace is visible.
4. If using SQLite, wait for the save status to confirm the latest changes are committed, or use the explicit **Save private workspace to SQLite** action.
5. Use **Create verified SQLite file backup** and wait for the verified filename and location. Copy the resulting `.sqlite` file to independent protected storage.
6. Also use the portable SQLite JSON export action; save the downloaded JSON to a separate private backup folder and copy it to independent protected storage.
7. Record the export date and, if useful, a non-sensitive milestone note.

If automatic SQLite save is paused after retry exhaustion, do not assume the latest browser edits are included in the export. Resolve the save issue or explicitly save successfully before exporting.

## Recovery procedures

### Restore from the local SQLite snapshot

1. Start the local dashboard and review the currently displayed workspace.
2. If possible, export the current committed SQLite snapshot before replacing anything.
3. Run **Check database integrity**. If it fails, preserve the database file for diagnosis and use a known-good portable JSON export instead.
4. Use **Restore from SQLite** and review the preview, including counts across the 13 collections.
5. Confirm only when the preview represents the intended snapshot.
6. Inspect key balances, recent transactions, investment accounts/transactions, cash-ledger reconciliation, goals, budgets, and historical snapshot dates.

### Restore from a portable JSON export

1. Start the local dashboard on the destination device and switch to **Use my data**.
2. Preserve a separate copy of the current workspace/database if it may need recovery.
3. Use the dashboard's JSON backup import action and select the intended dated export.
4. Review schema version, currency, validation result, and collection counts before confirming.
5. After import, inspect important financial values and selected historical records.
6. Save the restored workspace to SQLite and wait for a successful save.
7. Export a fresh backup from the destination device and retain it as the new recovery point.

If import is rejected, preserve the rejected file for diagnosis. Do not repeatedly overwrite the current workspace or manually edit the JSON to bypass validation. Use another known-good export if available.

## Device migration checklist

- [ ] Export a fresh portable schema-v6 JSON backup after the latest SQLite save succeeds.
- [ ] Copy it to a separate protected location.
- [ ] Set up the destination with the repository's supported Node.js runtime and dashboard dependencies.
- [ ] Start the local dashboard and import the JSON backup.
- [ ] Review the preview and all 13 collection counts before confirming.
- [ ] Inspect key financial values and historical records.
- [ ] Save the restored workspace to the destination SQLite database and confirm success.
- [ ] Run the database integrity check.
- [ ] Export and retain a fresh destination backup.
- [ ] Only then retire or wipe the old device/profile/database.

## Important limitations

- Browser-local storage and SQLite are separate persistence systems; they are not one atomic transaction.
- SQLite automatic saves are optional/debounced and bounded retries do not guarantee persistence during a prolonged outage.
- SQLite and JSON exports are not encrypted by this feature.
- The SQLite database defaults outside the repository and is not a cloud backup or multi-device synchronization service.
- Browser-local storage is tied to the browser profile and can be lost if that profile is cleared.
- Automatic SQLite saves do not create historical backup generations.
- Online SQLite backup is manual and user-initiated. Automated scheduling, rotation, retention enforcement, encryption, remote backup and scheduled restore drills are not implemented.
- A structurally valid backup does not guarantee financial correctness. Review restored values against trusted source records.

## Schema-v7 allocation-policy backups

The current SQLite workspace and full private-workspace JSON export use schema v7 and contain 14 collections, including investment allocation policy versions. The v6→v7 migration creates a protected `.pre-v7-*.json` recovery artifact before changing the database; the new allocation-policy collection starts empty. No policies are fabricated during migration.

Schema-v7 backup previews include the number of allocation-policy versions. Legacy v1–v6 backups remain importable and do not replace the existing allocation-policy collection when that collection was not part of the backup. After restoring a v7 backup, verify the policy names, versions, currency and target totals alongside the investment ledger.
