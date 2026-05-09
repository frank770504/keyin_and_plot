const SESSION_ID = crypto.randomUUID();
const adminName = localStorage.getItem('username') || '';
let lockInterval = null;

const lockStatusText = document.getElementById('lock-status-text');
const adminNameDisplay = document.getElementById('admin-name-display');
const backupListBody = document.getElementById('backup-list-body');

adminNameDisplay.textContent = adminName ? adminName : 'Unknown (Please set name in workspace)';

// Initialize
if (adminName) {
    acquireLock();
} else {
    lockStatusText.textContent = 'Status: Please return to the Workspace and set your name to enable restore.';
    lockStatusText.style.color = '#856404'; // warning color
    renderBackups([], true);
}

window.addEventListener('beforeunload', () => {
    releaseLock();
});

async function acquireLock() {
    if (!adminName) return;
    
    try {
        const response = await fetch('/api/lock/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_name: `Admin - ${adminName}`, session_id: SESSION_ID })
        });
        
        if (response.ok) {
            lockStatusText.textContent = `Status: Lock acquired. System is locked by ${adminName}.`;
            lockStatusText.style.color = '#155724'; // success color
            startHeartbeat();
            fetchBackups();
        } else {
            const data = await response.json();
            lockStatusText.textContent = `Status: Locked by ${data.user_name}. Cannot restore.`;
            lockStatusText.style.color = '#721c24'; // danger color
            stopHeartbeat();
            fetchBackups(true); // Fetch but render as disabled
        }
    } catch (error) {
        console.error('Failed to acquire lock:', error);
        lockStatusText.textContent = 'Status: Error connecting to server.';
        lockStatusText.style.color = '#721c24';
    }
}

function startHeartbeat() {
    stopHeartbeat();
    lockInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/lock/heartbeat', {
                method: 'POST',
                headers: { 'X-Session-ID': SESSION_ID }
            });
            if (!response.ok) {
                console.warn('Lost lock heartbeat');
                acquireLock(); // Try to reacquire
            }
        } catch (error) {
            console.error('Heartbeat failed', error);
        }
    }, 5000);
}

function stopHeartbeat() {
    if (lockInterval) {
        clearInterval(lockInterval);
        lockInterval = null;
    }
}

function releaseLock() {
    stopHeartbeat();
    navigator.sendBeacon('/api/lock/release', new Blob([JSON.stringify({ session_id: SESSION_ID })], { type: 'application/json' }));
}

async function fetchBackups(disabled = false) {
    try {
        const response = await fetch('/api/admin/backups');
        if (response.ok) {
            const backups = await response.json();
            renderBackups(backups, disabled);
        } else {
            console.error('Failed to fetch backups');
        }
    } catch (error) {
        console.error('Error fetching backups:', error);
    }
}

function renderBackups(backups, disabled) {
    backupListBody.innerHTML = '';
    if (!backups || backups.length === 0) {
        backupListBody.innerHTML = `<tr><td colspan="2" style="text-align: center;">No backups available.</td></tr>`;
        return;
    }
    
    backups.forEach(backup => {
        const tr = document.createElement('tr');
        
        const nameTd = document.createElement('td');
        nameTd.textContent = backup;
        
        const actionTd = document.createElement('td');
        actionTd.style.textAlign = 'center';
        
        const restoreBtn = document.createElement('button');
        restoreBtn.textContent = 'Restore';
        restoreBtn.className = 'btn-danger btn-small';
        if (disabled) {
            restoreBtn.disabled = true;
            restoreBtn.title = 'System is locked by another user';
        } else {
            restoreBtn.onclick = () => confirmRestore(backup);
        }
        
        actionTd.appendChild(restoreBtn);
        
        tr.appendChild(nameTd);
        tr.appendChild(actionTd);
        
        backupListBody.appendChild(tr);
    });
}

async function confirmRestore(filename) {
    if (confirm(`WARNING: Are you sure you want to restore "${filename}"? This will overwrite the current database and ALL current data. A safety copy will be created, but this is a destructive operation.`)) {
        try {
            const response = await fetch('/api/admin/restore', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Session-ID': SESSION_ID
                },
                body: JSON.stringify({ filename })
            });
            
            if (response.ok) {
                alert('Database restored successfully! Reloading...');
                window.location.reload();
            } else {
                const data = await response.json();
                alert(`Restore failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Restore error:', error);
            alert('An error occurred while attempting to restore the database.');
        }
    }
}