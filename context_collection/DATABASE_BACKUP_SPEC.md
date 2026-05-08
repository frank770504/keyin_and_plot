# Technical Specification: Atomic Database Backup & Restore System

## 1. Overview
The Database Backup & Restore System provides automated, non-blocking data protection and a safe, interactive recovery mechanism for the `project.db` SQLite database. It is designed to protect against both system failures and human error (accidental edits/deletions).

## 2. Automated Backup Service (`tools/backup_service.py`)

### A. Atomic Snapshots
- **Technology**: Utilizes SQLite's `VACUUM INTO` command.
- **Benefit**: Creates a fully consistent, defragmented backup file even during active write operations. It avoids "hot journal" corruption and does not lock the database, ensuring zero downtime for users.

### B. Trigger Logic
- **Daily Automated**: Triggered on `app.py` startup if the last automated backup is older than 24 hours.
- **Pre-Save (Undo Points)**: Automatically triggered in `api.py` whenever a user "Commits" changes to a measurement. This creates a "before" snapshot, allowing users to revert accidental data overwrites.
- **Manual**: Triggered instantly via the "Manual Backup" button in the UI.

### C. Named Snapshots
Backups follow a naming convention: `{prefix}_backup_YYYYMMDD_HHMMSS.db`
- `project_backup_...`: Automated daily backups (Auto).
- `pre_save_backup_...`: Triggered on measurement commit (Undo Point).
- `manual_backup_...`: Triggered by user action (Manual).

### D. Retention Policy
- **Rotation**: The service scans the `backups/` directory during each run.
- **Pruning**: Files older than **14 days** are automatically deleted to manage storage overhead.

## 3. UI Integration (`static/js/ui/database_ui.js`)

### A. Toggleable Management Panel
- **Interface**: A collapsible section at the bottom of the sidebar.
- **State**: Collapsed by default to maintain focus on measurements. Clicking the "Database Management" header toggles visibility.
- **Dynamic Loading**: Backup metadata (filename, size, date) is only fetched from the API when the panel is expanded.

### B. Data Portability
- **Export**: A "Download DB" button allows users to download the current `project.db` file directly from the browser for offline analysis or migration.
- **Size Reporting**: The backup list displays human-readable file sizes (e.g., `128.0 KB`) to provide visibility into disk usage.

## 4. Restore Utility & Logic

### A. Safe Restoration (`tools/restore_db.py` & `api.py`)
- **Lock Detection**: Queries the `GlobalLock` table. Restoration is blocked if *another* user holds an active lock. It is permitted if the requester holds the lock or if no lock exists.
- **Safety Copy**: Before overwriting the live database, the system creates a timestamped safety copy (e.g., `project.db.safety_YYYYMMDD_HHMMSS.bak`) in the project root.

### B. Execution Flows
- **Browser-based**: Users select a snapshot from the UI list and click "Restore". The application performs the restore and forces a page reload to ensure all state is synchronized with the new data.
- **CLI-based**: Administrators can run `python tools/restore_db.py` for a guided command-line restoration.

## 5. Administrative Security

### A. Secret Admin Token
- **Mechanism**: All administrative APIs (`/api/admin/*`) require a valid `X-Admin-Token` in the request header.
- **Verification**: The system uses a master `ADMIN_TOKEN` defined on the backend (default: `admin123`, configurable via environment variable).
- **Frontend Flow**: 
    - When a user attempts to expand the "Database Management" section, the UI checks for a stored token in `localStorage`.
    - If missing or invalid, the user is prompted for the Administrative Token via a secure prompt.
    - Upon successful verification with the `/api/admin/verify` endpoint, the token is cached locally to authorize future requests.

## 6. Implementation Details
- **Location**: Logic is decoupled into the `tools/` package.
- **Git Integrity**: The `backups/` directory and `.bak` safety copies are excluded via `.gitignore`.
- **Dependencies**: Standard library only (`os`, `sqlite3`, `shutil`, `datetime`).
