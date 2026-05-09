import os
import sqlite3
import shutil
from datetime import datetime, timedelta

BACKUP_DIR = 'backups'
DB_FILE = 'project.db'
RETENTION_DAYS = 14

def get_db_path():
    # Tools is in the project root, so the root is the parent of this file's directory
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    return os.path.join(root_dir, DB_FILE)

def get_backup_dir():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    return os.path.join(root_dir, BACKUP_DIR)

def perform_backup():
    """Performs an atomic backup using SQLite's VACUUM INTO."""
    db_path = get_db_path()
    backup_dir = get_backup_dir()

    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(backup_dir, f'project_backup_{timestamp}.db')

    print(f"Starting atomic backup to {backup_path}...")
    try:
        # VACUUM INTO creates a new, consistent database file from the current one.
        # It is safe to run while the database is being accessed.
        conn = sqlite3.connect(db_path)
        conn.execute(f"VACUUM INTO '{backup_path}'")
        conn.close()
        print("Backup completed successfully.")
        return backup_path
    except Exception as e:
        print(f"Backup failed: {e}")
        return None

def rotate_backups():
    """Deletes backups older than RETENTION_DAYS."""
    backup_dir = get_backup_dir()
    if not os.path.exists(backup_dir):
        return

    now = datetime.now()
    retention_threshold = now - timedelta(days=RETENTION_DAYS)

    print(f"Checking for backups older than {RETENTION_DAYS} days...")
    for filename in os.listdir(backup_dir):
        if filename.startswith('project_backup_') and filename.endswith('.db'):
            file_path = os.path.join(backup_dir, filename)
            file_time = datetime.fromtimestamp(os.path.getmtime(file_path))

            if file_time < retention_threshold:
                print(f"Deleting old backup: {filename}")
                os.remove(file_path)

def check_and_trigger():
    """Triggers a backup if the last one was more than 24 hours ago."""
    backup_dir = get_backup_dir()
    if not os.path.exists(backup_dir):
        perform_backup()
        rotate_backups()
        return

    backups = [f for f in os.listdir(backup_dir) if f.startswith('project_backup_')]
    if not backups:
        perform_backup()
        rotate_backups()
        return

    # Get the most recent backup
    backups.sort()
    last_backup = backups[-1]
    last_backup_path = os.path.join(backup_dir, last_backup)
    last_backup_time = datetime.fromtimestamp(os.path.getmtime(last_backup_path))

    if datetime.now() - last_backup_time > timedelta(hours=24):
        print("Last backup was more than 24 hours ago.")
        perform_backup()
        rotate_backups()
    else:
        print("Database recently backed up. Skipping.")

if __name__ == '__main__':
    # Allow manual trigger
    check_and_trigger()
