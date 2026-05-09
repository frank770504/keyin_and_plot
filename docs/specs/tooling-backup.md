# Technical Specification: Atomic Database Backup & Restore System

## 1. Overview
The Database Backup & Restore System provides automated, non-blocking data protection and a safe recovery mechanism for the `project.db` SQLite database. It includes both a CLI utility and a secure, web-based Admin Area for restoring data without needing terminal access.

## 2. Automated Backup Service (`tools/backup_service.py`)

### A. Atomic Snapshots
- **Technology**: Utilizes SQLite's `VACUUM INTO` command.
- **Benefit**: Unlike standard file copying (`cp`), `VACUUM INTO` creates a fully consistent, defragmented backup file even if the database is currently being written to by the application. It avoids "hot journal" corruption and does not lock the database during the process.

### B. Trigger Logic
- **Integration**: The service is imported and called within `app.py` during the Flask application startup sequence.
- **Interval**: To prevent excessive disk usage during frequent restarts, a new backup is only triggered if the most recent backup file is older than **24 hours**.

### C. Retention Policy
- **Rotation**: The service automatically scans the `backups/` directory during each run.
- **Pruning**: Files older than **14 days** (based on file modification time) are automatically deleted to manage storage overhead.

## 3. Restore Utility (`tools/restore_db.py`)
Provides the core logic used by both the CLI and the web Admin Area.

### A. Safety Checks
- **Lock Detection**: Queries the `GlobalLock` table before proceeding. If a user is currently editing, it raises a warning/error to prevent data loss.
- **Safety Copy**: Before overwriting `project.db`, the script creates a timestamped safety copy (e.g., `project.db.safety_YYYYMMDD_HHMMSS.bak`) in the project root. This allows for an "undo" if the wrong backup was selected.

### B. CLI Interactive Flow
1. **Listing**: Scans `backups/` and presents a numbered list of available snapshots.
2. **Selection**: Prompts the user for a backup index.
3. **Confirmation**: Requires explicit 'y' confirmation.

## 4. Web Admin Area & Authentication

To allow operators to restore backups safely without CLI access, a protected `/admin` route is available.

### A. Authentication
- **Storage**: Uses `python-dotenv` to load `ADMIN_PASSWORD` and `SECRET_KEY` from a `.env` file.
- **Login Flow**: Users accessing `/admin` without an active session are redirected to `/admin/login`.
- **Session Management**: Upon entering the correct password, a cryptographically signed Flask session cookie (`admin_logged_in`) is issued.
- **API Protection**: The endpoints `/api/admin/backups` (GET) and `/api/admin/restore` (POST) are strictly protected and require the active session cookie to function.

### B. Global Editor Lock Integration
- **Lock Acquisition**: When the `/admin` page loads, the frontend automatically acquires the `GlobalLock` on behalf of the user (e.g., "Admin - Bob").
- **Exclusivity**: This immediately prevents any other users in the workspace from starting edits or creating new measurements, completely eliminating the risk of someone writing data while a restore is in progress.
- **Heartbeat**: The Admin page maintains the lock via a regular heartbeat interval until the page is closed or the user clicks "Logout".

### C. Web Restore Execution
- **Connections**: The `/api/admin/restore` endpoint explicitly clears all active SQLAlchemy connections (`db.session.remove()`, `db.engine.dispose()`) before executing the overwrite. This prevents file lock errors on Windows/Linux environments.

## 5. Implementation Details
- **Location**: Core logic in `tools/restore_db.py`.
- **Init Script**: `tools/init_env.py` is provided to automatically generate a secure `.env` file with a cryptographically strong `SECRET_KEY` and an operator-defined `ADMIN_PASSWORD` on new server deployments.
- **Dependencies**: Standard library, `Flask` sessions, `python-dotenv`.
