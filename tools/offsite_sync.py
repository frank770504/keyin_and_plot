import os
import sqlite3
import shutil
import time
from datetime import datetime, timedelta, UTC
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BACKUP_DIR = 'backups'
DB_FILE = 'project.db'
SECONDARY_RETENTION_DAYS = 30

def get_root_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def log_event(event_type, status, message):
    """Logs a system event directly to the SQLite database."""
    db_path = os.path.join(get_root_dir(), DB_FILE)
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        timestamp = datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            "INSERT INTO system_events (event_type, status, message, timestamp) VALUES (?, ?, ?, ?)",
            (event_type, status, message, timestamp)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to log event to DB: {e}")

def verify_integrity(db_path):
    """Performs a PRAGMA integrity_check on the SQLite database."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        result = cursor.fetchone()[0]
        conn.close()
        return result == 'ok'
    except Exception as e:
        print(f"Integrity check failed: {e}")
        return False

def run_secondary_sync():
    root_dir = get_root_dir()
    primary_backup_dir = os.path.join(root_dir, BACKUP_DIR)
    secondary_path = os.environ.get('SECONDARY_BACKUP_PATH')

    if not secondary_path:
        log_event('backup_secondary', 'failure', 'SECONDARY_BACKUP_PATH not defined in .env')
        return

    if not os.path.exists(secondary_path):
        try:
            os.makedirs(secondary_path)
        except Exception as e:
            log_event('backup_secondary', 'failure', f'Could not create secondary path: {e}')
            return

    # 1. Find latest primary backup
    if not os.path.exists(primary_backup_dir):
        log_event('backup_secondary', 'failure', 'Primary backup directory does not exist')
        return

    backups = [f for f in os.listdir(primary_backup_dir) if f.startswith('project_backup_') and f.endswith('.db')]
    if not backups:
        log_event('backup_secondary', 'failure', 'No primary backups found to sync')
        return

    backups.sort()
    latest_backup = backups[-1]
    latest_backup_path = os.path.join(primary_backup_dir, latest_backup)

    # 2. Verify Integrity
    if not verify_integrity(latest_backup_path):
        log_event('backup_secondary', 'failure', f'Integrity check failed for {latest_backup}')
        return

    # 3. Sync to Secondary
    target_path = os.path.join(secondary_path, latest_backup)
    if os.path.exists(target_path):
        log_event('backup_secondary', 'success', f'Latest backup {latest_backup} already synced')
    else:
        try:
            shutil.copy2(latest_backup_path, target_path)
            log_event('backup_secondary', 'success', f'Synced {latest_backup} to secondary storage')
        except Exception as e:
            log_event('backup_secondary', 'failure', f'Sync failed: {e}')
            return

    # 4. Prune Secondary Storage (30 days)
    try:
        now = datetime.now()
        retention_threshold = now - timedelta(days=SECONDARY_RETENTION_DAYS)
        for filename in os.listdir(secondary_path):
            if filename.startswith('project_backup_') and filename.endswith('.db'):
                file_path = os.path.join(secondary_path, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_time < retention_threshold:
                    os.remove(file_path)
    except Exception as e:
        log_event('backup_secondary', 'failure', f'Pruning secondary storage failed: {e}')

if __name__ == '__main__':
    run_secondary_sync()
