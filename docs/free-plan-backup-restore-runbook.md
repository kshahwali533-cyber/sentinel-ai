# Free-plan database backup and restore runbook

Status: **Procedure documented; no backup has been created or restored yet. This is not a passed release gate.**

This runbook is for Sentinel AI's Supabase Free project. It is intentionally non-destructive: create logical exports, verify them away from Production, and restore only into a separate disposable project. Never test a restore over the live project.

## Plan constraints

- Supabase Free does not include automatic daily database backups. Supabase recommends regular exports with the Supabase CLI and off-site retention.
- A logical database dump is not a complete Supabase project backup. The CLI excludes Supabase-managed schemas such as `auth` and `storage`, and database dumps do not contain Storage file objects.
- Auth configuration, API keys, Realtime settings, Edge Functions, project settings, extensions, and Storage objects require separate inventory/export/reconfiguration steps.
- Do not place database URLs, passwords, access tokens, JWT secrets, service-role keys, or exported user data in Git, GitHub issues/PRs, chat, or public storage.

## 1. Prepare a secure workstation

A trusted computer with the current Supabase CLI, Docker, PostgreSQL client tools, and encrypted local storage is required. A phone-only workflow is not a safe or practical way to perform a full export and restore verification.

Check installed versions using `supabase --version`, `supabase --help`, and `supabase db dump --help`. Supabase CLI v3 uses explicit `--remote` targets; verify flags against the installed CLI before running. Do not assume a command targets local or remote correctly.

## 2. Create logical exports

1. Open Supabase Dashboard → Project → Connect and obtain the database connection string. Prefer the direct connection; use the Session Pooler if the network cannot reach the direct endpoint.
2. Store the connection string in a local shell variable or secret manager, not in a committed file or shell history. Never paste it into chat.
3. Create a new, access-restricted backup directory outside the repository.
4. Run the current documented CLI dump workflow, explicitly targeting the Production database URL:

```sh
supabase db dump --remote="$PRODUCTION_DB_URL" -f roles.sql --role-only
supabase db dump --remote="$PRODUCTION_DB_URL" -f schema.sql
supabase db dump --remote="$PRODUCTION_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

These are logical database exports, not a full platform backup. Confirm the CLI output's `Target:` line identifies the intended Production project before relying on the files. If the CLI version rejects a flag, stop and consult its installed help and current official documentation; do not improvise against Production.

5. Record file sizes and cryptographic checksums (for example, `sha256sum roles.sql schema.sql data.sql`). Keep a dated inventory and store an encrypted copy in a private off-site location. Never commit the export files to this repository.
6. Separately inventory Storage buckets and securely export required Storage objects. Record Auth/project configuration and Edge Function deployment/configuration separately; do not assume the SQL dumps contain them.

## 3. Verify a restore without touching Production

1. Create a separate disposable Supabase project or a local Supabase/Postgres environment. Do not point restore commands at the Production connection string.
2. Configure required PostgreSQL extensions and database webhooks in the test target as appropriate.
3. Follow the current official Supabase **Backup and Restore using the CLI** guide to restore `roles.sql`, `schema.sql`, and `data.sql` into the empty test target. The official procedure uses a single-transaction `psql` restore and has special handling for data import; follow its current instructions exactly.
4. Verify schema objects, row counts for required Sentinel tables, indexes, constraints, grants, RLS enabled state and policies, and representative application queries. Verify that no secrets or production credentials were copied into the test environment.
5. Test Storage object recovery separately. Reconfigure Auth settings, API keys, Edge Functions, Realtime publications, integrations, and project settings using a reviewed inventory; these are not automatically restored by the database dump.
6. Record the restore date, CLI/Postgres versions, checksums, target environment, validation results, and any omissions. Destroying the disposable test project is a separate deliberate action and is not part of this runbook.

## 4. Production recovery guardrails

- Never restore an older dump over the live Production database as a first recovery action. Prefer restoring into a new isolated project, validating it, and preparing a reviewed migration/cutover plan.
- Any live database restore, migration, credential rotation, or project setting change requires explicit approval and a maintenance/rollback plan.
- Preserve the current known-good Vercel Production deployment independently; a Vercel rollback does not restore database state.
- Keep at least one encrypted off-site copy and periodically repeat the restore test. A successful dump alone is not proof of recoverability.

## Official references

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI reference: db dump](https://supabase.com/docs/reference/cli/supabase-issue-feature)

## Release-gate status

- [x] Free-plan limitation and supported logical-export approach documented.
- [x] Non-destructive isolated-restore procedure and platform-data exclusions documented.
- [ ] Production logical export actually created and checksummed.
- [ ] Encrypted off-site copy confirmed.
- [ ] Restore completed successfully in an isolated target.
- [ ] Storage objects and Auth/platform configuration recovery separately verified.

Until all applicable unchecked items are evidenced, the backup/restore release gate remains **OPEN**.
