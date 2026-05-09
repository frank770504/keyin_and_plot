import os
import sqlite3
import shutil
from datetime import datetime

BACKUP_DIR = 'backups'
DB_FILE = 'project.db'

def get_project_root():
    # Tools is in the project root, so the root is the parent of this file's directory
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def get_db_path():
    return os.path.join(get_project_root(), DB_FILE)

def get_backup_dir():
    return os.path.join(get_project_root(), BACKUP_DIR)

def check_lock():
    """Checks if the database is currently locked by an editor."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Check if GlobalLock table exists and has any entries
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='global_lock'")
        if cursor.fetchone():
            cursor.execute("SELECT count(*) FROM global_lock")
            count = cursor.fetchone()[0]
            conn.close()
            return count > 0
        conn.close()
        return False
    except Exception as e:
        print(f"Error checking lock: {e}")
        return False

def list_backups():
    backup_dir = get_backup_dir()
    if not os.path.exists(backup_dir):
        print("No backups directory found.")
        return []

    backups = [f for f in os.listdir(backup_dir) if f.startswith('project_backup_') and f.endswith('.db')]
    backups.sort(reverse=True)
    return backups

def restore_backup(backup_filename):
    db_path = get_db_path()
    backup_dir = get_backup_dir()
    backup_path = os.path.join(backup_dir, backup_filename)

    if not os.path.exists(backup_path):
        print(f"Backup file {backup_filename} not found.")
        return False

    # 1. Create a safety copy of the current DB
    if os.path.exists(db_path):
        safety_path = f"{db_path}.safety_{datetime.now().strftime('%Y%m%d_%H%M%S')}.bak"
        print(f"Creating safety copy of current database: {safety_path}")
        shutil.copy2(db_path, safety_path)

    # 2. Perform the restore
    print(f"Restoring {backup_filename} to {db_path}...")
    try:
        shutil.copy2(backup_path, db_path)
        print("Restore completed successfully.")
        return True
    except Exception as e:
        print(f"Restore failed: {e}")
        return False

def main():
    print("--- Database Restore Utility ---")
    
    if check_lock():
        print("\nWARNING: The database is currently LOCKED by an editor.")
        print("Restoring now might cause data loss or inconsistency for the active user.")
        confirm = input("Are you sure you want to proceed? (y/N): ")
        if confirm.lower() != 'y':
            print("Restore aborted.")
            return

    backups = list_backups()
    if not backups:
        print("No backups available to restore.")
        return

    print("\nAvailable backups:")
    for i, backup in enumerate(backups):
        print(f"{i + 1}. {backup}")

    try:
        choice = int(input(f"\nSelect a backup to restore (1-{len(backups)}) or 0 to cancel: "))
        if choice == 0:
            print("Restore cancelled.")
            return
        if 1 <= choice <= len(backups):
            selected_backup = backups[choice - 1]
            confirm = input(f"Are you sure you want to restore {selected_backup}? This will overwrite the current database. (y/N): ")
            if confirm.lower() == 'y':
                restore_backup(selected_backup)
            else:
                print("Restore cancelled.")
        else:
            print("Invalid choice.")
    except ValueError:
        print("Invalid input. Please enter a number.")

if __name__ == '__main__':
    main()
