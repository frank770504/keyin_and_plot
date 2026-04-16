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

// --- Dataset APIs ---

export async function getDatasets() {
    const response = await fetch('/api/datasets');
    if (!response.ok) throw new Error('Failed to fetch datasets');
    return await response.json();
}

export async function createDataset(name) {
    const response = await fetchWithLock('/api/datasets', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create dataset');
    }
    return await response.json();
}

export async function getDatasetPoints(name) {
    const response = await fetch(`/api/datasets/${name}`);
    if (!response.ok) throw new Error('Failed to fetch dataset details');
    return await response.json();
}

export async function startEdit(name) {
    const response = await fetchWithLock(`/api/datasets/${name}/edit/start`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to start edit mode');
    return await response.json();
}

export async function commitEdit(name) {
    const response = await fetchWithLock(`/api/datasets/${name}/edit/commit`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to commit changes');
    return await response.json();
}

export async function rollbackEdit(name) {
    const response = await fetchWithLock(`/api/datasets/${name}/edit/rollback`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to rollback changes');
}

export async function updateMetadata(name, data) {
    const response = await fetchWithLock(`/api/datasets/${name}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update metadata');
    return await response.json();
}

export async function deleteDataset(name) {
    const response = await fetchWithLock(`/api/datasets/${name}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete dataset');
    return await response.json();
}

export async function duplicateDataset(name) {
    const response = await fetchWithLock(`/api/datasets/${name}/duplicate`, { method: 'POST' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate dataset');
    }
    return await response.json();
}

export async function addPoint(datasetName, N, eta, torque) {
    const response = await fetchWithLock(`/api/datasets/${datasetName}/points`, {
        method: 'POST',
        body: JSON.stringify({ N, eta, torque })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add point');
    }
    return await response.json();
}

export async function updatePoint(datasetName, pointId, N, eta, torque) {
    const response = await fetchWithLock(`/api/datasets/${datasetName}/points/${pointId}`, {
        method: 'PUT',
        body: JSON.stringify({ N, eta, torque })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update point');
    }
    return await response.json();
}

export async function deletePoint(datasetName, pointId) {
    const response = await fetchWithLock(`/api/datasets/${datasetName}/points/${pointId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete point');
    return await response.json();
}

export async function getRegressionData(name, type) {
    const url = type === 'linear' ? `/api/datasets/${name}/regression` : `/api/datasets/${name}/power-regression`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch regression data');
    }
    return await response.json();
}
