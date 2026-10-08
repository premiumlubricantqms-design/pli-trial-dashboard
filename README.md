# PLI Sample Request & Trial Follow-up Dashboard

Thai and English dashboards for Sales and GM meeting updates. Based on the approved four-section dashboard: sample information, preparation and delivery, trial and follow-up, conclusion and closure. Includes three chart types, customer/requester rankings, chart-to-register filters, sortable tables, record details, light/dark mode, font sizing, presentation mode, PDF printing and back-to-top navigation.

## Data boundary

This public repository contains application code, embedded licensed fonts and chart/Excel libraries only. It contains **no customer records, workbook, OneDrive sharing link, Microsoft tokens or passwords**. Data is downloaded from the original OneDrive workbook at runtime and kept on the private service. The backend never modifies the OneDrive file. Authenticated viewers can access the workbook used by the dashboard; share the dashboard password only with authorized viewers.

Near-real-time means polling, not instant push: the server reads OneDrive every 300 seconds and browsers check for a new version every 30 seconds while visible. Excel changes must be saved to OneDrive. Failed syncs retain the last successful in-memory snapshot and show its timestamp; after a service restart a new successful read is required. A Free Render instance sleeps when inactive, so it cannot provide continuous polling. Use paid compute with a persistent disk for production; confirm costs before selecting paid resources.

## Render configuration

1. Create a **Web Service** from this repository, branch `main`.
2. Choose **Docker** as Language. Root Directory is blank. Dockerfile Path is `./Dockerfile`. Do not enter Python Build or Start commands: Docker's CMD starts Gunicorn.
3. Add environment variables:

| Key | Value |
| --- | --- |
| `DASHBOARD_PASSWORD` | A unique password of at least 16 characters; enter only in Render |
| `SECRET_KEY` | Generate a random value of at least 32 characters in Render |
| `DATA_DIR` | `/app/storage` |
| `SYNC_INTERVAL_SECONDS` | `300` |
| `ONEDRIVE_REMOTE` | `onedrive` |
| `ONEDRIVE_FILE_PATH` | Exact path inside the authorized drive, e.g. `Folder/Sample Request and Trial Follow-up.xlsx`; not a sharing URL |

4. Add Health Check Path `/healthz` under Advanced.
5. Before production, attach a persistent disk at `/app/storage`. This preserves refreshed OneDrive credentials across service restarts. A disk requires paid compute and has a separate charge.
6. Add a **Secret File** named `rclone.conf` in Render using the authorized configuration below. Do not commit it or paste it in a chat or issue. The application initially copies `/etc/secrets/rclone.conf` into the private writable storage directory; rclone then maintains refreshed tokens there. To replace a revoked config, remove the existing private `/app/storage/rclone.conf` and restart so the new seed is copied.
7. Deploy. Open the assigned Render URL and sign in. `/` and `/th` open Thai, `/en` opens English.

For an initial Free deployment, leave the OneDrive variables/secret file unconfigured and test using the local file fallback. Free storage is temporary: this is a preview, not a reliable continuously connected production installation.

## OneDrive Personal authorization (no custom client ID)

Install rclone from https://rclone.org/downloads/ on a trusted computer. Run `rclone config`, create a remote named `onedrive`, choose storage type `onedrive`, and leave Client ID and Client Secret blank to use rclone's built-in application. Sign in with the Microsoft account that owns the original Excel file, and select the personal drive. Request read scopes in advanced configuration when supported (`Files.Read Files.Read.All offline_access`); review the actual Microsoft consent screen. The app performs downloads only, but token permissions must not be assumed narrower than the consent granted.

Use `rclone lsf onedrive:` to locate the file's path and `rclone config file` to find the configuration file. Upload its contents **only** as the Render Secret File, and set the exact file path above. Configure only this remote in the file supplied to the service. A shared link alone is not the drive-relative path.

## Verification before executive sharing

- Confirm the correct OneDrive account, file and **Sample Trial Record** worksheet.
- Check record counts and several request numbers against Excel, including empty fields (Thai: ไม่ได้ระบุ; English: Not specified).
- Edit and save a test field in the original workbook; verify it appears within about 5½ minutes while the service is awake, and restore the field.
- Restart the service to confirm token persistence; ensure sync continues.
- Open the URL signed out: the dashboard and workbook API must require login.
- Test chart types, drill-down, filtering, sorting, Thai/English, mobile layouts and PDF using actual presentation devices.

Local automated tests cover access control, CSRF, snapshots, worksheet validation and sync failures. Live Microsoft authorization, Render deployment, mobile visual QA and PDF output require end-to-end verification after setup; they are not claimed complete by these tests.

## Local development

Install `requirements.txt`; set the access password and secret key in your environment, set `COOKIE_SECURE=false` for local HTTP only, and run `gunicorn --workers 1 --threads 4 app:app`. Use one worker because sync and snapshot state are process-local. Do not set `COOKIE_SECURE=false` on Render.

`DISABLE_SYNC=true python -m unittest discover -s tests -v` runs backend tests. Test workbooks are generated in temporary directories and are not real customer data.

Footer: Copy Right: Premium Lubricant International Co., 2026 Cr.ChatGPT&Codex 6.1SolLight
