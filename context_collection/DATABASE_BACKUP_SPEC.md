# Technical Specification: Atomic Database Backup & Restore System

## 1. Overview
The Database Backup & Restore System provides automated, non-blocking data protection and a safe, interactive recovery mechanism for the `project.db` SQLite database.

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

### A. Safety Checks
- **Lock Detection**: The utility queries the `GlobalLock` table before proceeding. If a user is currently editing, it issues a high-visibility warning to prevent data loss for the active session.
- **Safety Copy**: Before overwriting `project.db`, the script creates a timestamped safety copy (e.g., `project.db.safety_YYYYMMDD_HHMMSS.bak`) in the project root. This allows for an "undo" if the wrong backup was selected.

### B. Interactive Flow
1. **Listing**: Scans `backups/` and presents a numbered list of available snapshots, sorted from newest to oldest.
2. **Selection**: Prompts the user for a backup index.
3. **Confirmation**: Requires explicit 'y' confirmation before performing the destructive overwrite.

## 4. Implementation Details
- **Location**: All backup logic is decoupled into the `tools/` package.
- **Path Resolution**: Scripts use relative path calculation (parent of `__file__`) to ensure they correctly target the project root and `backups/` directory regardless of where the python process is invoked.
- **Dependencies**: Standard library only (`os`, `sqlite3`, `shutil`, `datetime`).
