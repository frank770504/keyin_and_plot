// static/js/api.js
import state from './state.js';

async function fetchWithLock(url, options = {}) {
    const headers = options.headers || {};
    headers['X-Session-ID'] = state.sessionID;
    headers['Content-Type'] = 'application/json';

    return fetch(url, { ...options, headers });
}

// --- Lock APIs ---

export async function getLockStatus() {
    const response = await fetchWithLock('/api/lock');
    return await response.json();
}

export async function acquireLock(userName, sessionID) {
    const response = await fetch('/api/lock/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName, session_id: sessionID })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to acquire lock');
    }
    return await response.json();
}

export async function releaseLock() {
    const response = await fetchWithLock('/api/lock/release', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to release lock');
}

export async function sendHeartbeat() {
    const response = await fetchWithLock('/api/lock/heartbeat', { method: 'POST' });
    if (!response.ok) throw new Error('Lock lost');
}

// --- Measurement APIs ---

export async function getMeasurements() {
    const response = await fetchWithLock('/api/measurements');
    if (!response.ok) throw new Error('Failed to fetch measurements');
    return await response.json();
}

export async function addMeasurement(name) {
    const response = await fetchWithLock('/api/measurements', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add measurement');
    }
    return await response.json();
}

export async function getMeasurementPoints(name) {
    const response = await fetchWithLock(`/api/measurements/${name}`);
    if (!response.ok) throw new Error('Failed to fetch measurement details');
    return await response.json();
}

export async function startEdit(name) {
    const response = await fetchWithLock(`/api/measurements/${name}/edit/start`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to start edit mode');
    return await response.json();
}

export async function commitEdit(name) {
    const response = await fetchWithLock(`/api/measurements/${name}/edit/commit`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to commit changes');
    return await response.json();
}

export async function rollbackEdit(name) {
    const response = await fetchWithLock(`/api/measurements/${name}/edit/rollback`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to rollback changes');
}

export async function updateMetadata(name, data) {
    const response = await fetchWithLock(`/api/measurements/${name}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update metadata');
    return await response.json();
}

export async function deleteMeasurement(name) {
    const response = await fetchWithLock(`/api/measurements/${name}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete measurement');
    return await response.json();
}

export async function duplicateMeasurement(name) {
    const response = await fetchWithLock(`/api/measurements/${name}/duplicate`, { method: 'POST' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate measurement');
    }
    return await response.json();
}

export async function addPoint(measurementName, N, eta, torque) {
    const response = await fetchWithLock(`/api/measurements/${measurementName}/points`, {
        method: 'POST',
        body: JSON.stringify({ N, eta, torque })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add point');
    }
    return await response.json();
}

export async function updatePoint(measurementName, pointId, N, eta, torque) {
    const response = await fetchWithLock(`/api/measurements/${measurementName}/points/${pointId}`, {
        method: 'PUT',
        body: JSON.stringify({ N, eta, torque })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update point');
    }
    return await response.json();
}

export async function deletePoint(measurementName, pointId) {
    const response = await fetchWithLock(`/api/measurements/${measurementName}/points/${pointId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete point');
    return await response.json();
}

export async function getRegressionData(name, type) {
    const url = type === 'linear' ? `/api/measurements/${name}/regression` : `/api/measurements/${name}/power-regression`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch regression data');
    }
    return await response.json();
}
