# Database Management Tools

This directory contains utilities for managing the Rheology Plotter database.

## 1. Database Restore Utility (`restore_db.py`)

The `restore_db.py` script allows you to safely restore the `project.db` from a previous backup.

### Usage
Run the script from the project root:
```bash
python3 tools/restore_db.py
```

### Safety Features
- **Lock Detection**: The script checks if the database is currently locked by an active editor. If a lock is detected, it warns the user and asks for confirmation before proceeding.
- **Safety Copy**: Before overwriting the current `project.db`, the script automatically creates a safety backup (e.g., `project.db.safety_20260508_104037.bak`).
- **Atomic Selection**: Lists all available backups in the `backups/` directory, sorted by date (newest first).

## 2. Backup Service (`backup_service.py`)

The `backup_service.py` is the engine behind the automated backup system.

### How it works
- **Trigger**: Integrated into `app.py`, it runs every time the application starts.
- **Interval**: Only performs a new backup if the last one was more than 24 hours ago.
- **Atomic Snapshots**: Uses SQLite's `VACUUM INTO` command, ensuring a consistent copy even if the database is being written to.
- **Retention**: Automatically prunes backups older than 14 days to save disk space.

### Manual Trigger
You can manually trigger a backup check at any time:
```bash
python3 tools/backup_service.py
```
