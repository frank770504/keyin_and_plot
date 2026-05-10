#!/bin/bash

# --- Rheology Plotter Launch & Cron Manager ---

# 1. Setup Environment Variables
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python"
SYNC_SCRIPT="$PROJECT_ROOT/tools/offsite_sync.py"
ENV_FILE="$PROJECT_ROOT/.env"

echo "-----------------------------------------------"
echo "🚀 Rheology Plotter: Initializing System..."
echo "Project Root: $PROJECT_ROOT"

# 2. Check for Virtual Environment
if [ ! -f "$VENV_PYTHON" ]; then
    echo "❌ Error: Virtual environment not found at $PROJECT_ROOT/.venv"
    echo "Please run: python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# 3. Check for SECONDARY_BACKUP_PATH in .env
if ! grep -q "SECONDARY_BACKUP_PATH" "$ENV_FILE"; then
    echo "⚠️  Warning: SECONDARY_BACKUP_PATH not found in .env"
    echo "Secondary backups will be logged as 'failure' until you define this path."
    echo "Example: SECONDARY_BACKUP_PATH=/path/to/backup"
fi

# 4. Configure Cron Job for Secondary Backup
# We'll set it to run daily at 2:00 AM
CRON_JOB="0 2 * * * cd $PROJECT_ROOT && $VENV_PYTHON $SYNC_SCRIPT >> $PROJECT_ROOT/backups/sync.log 2>&1"

# Check if the job already exists
(crontab -l 2>/dev/null | grep -F "$SYNC_SCRIPT" > /dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Secondary Backup cron job is already configured."
else
    echo "⚙️  Configuring Secondary Backup cron job (Daily at 2:00 AM)..."
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added successfully."
fi

# 5. Launch the Application
URL="127.0.0.1"
PORT="5001"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --url) URL="$2"; shift ;;
        --port) PORT="$2"; shift ;;
        *) echo "Usage: ./launch.sh [--url HOST] [--port PORT]"; exit 1 ;;
    esac
    shift
done

echo "🌐 Starting Flask Application on http://$URL:$PORT..."
echo "-----------------------------------------------"
exec "$VENV_PYTHON" app.py --url "$URL" --port "$PORT"
