// static/js/api.js
import state from './state.js';

/**
 * Enhanced fetch wrapper that automatically includes the Session ID
 * and handles common error scenarios.
 */
async function fetchWithLock(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Session-ID': state.sessionID,
        ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 403 || response.status === 409) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Permission Denied');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
}

export async function getLockStatus() {
    return fetchWithLock('/api/lock');
}

export async function acquireLock(userName) {
    return fetchWithLock('/api/lock/acquire', {
        method: 'POST',
        body: JSON.stringify({ user_name: userName, session_id: state.sessionID })
    });
}

export async function releaseLock() {
    // We use sendBeacon for reliable release on tab close, // but a standard POST for manual "Cancel/Save"
    return fetchWithLock('/api/lock/release', {
        method: 'POST',
        body: JSON.stringify({ session_id: state.sessionID })
    });
}

export async function sendHeartbeat() {
    return fetchWithLock('/api/lock/heartbeat', { method: 'POST' });
}

export async function fetchMeasurements() {
    return fetchWithLock('/api/measurements');
}

export async function createMeasurement(formulaId) {
    return fetchWithLock('/api/measurements', {
        method: 'POST',
        body: JSON.stringify({ formula_id: formulaId })
    });
}

export async function fetchMeasurementData(id) {
    const response = await fetchWithLock(`/api/measurements/${id}`);
    return response;
}

export async function startEditMode(id) {
    const response = await fetchWithLock(`/api/measurements/${id}/edit/start`, { method: 'POST' });
    return response;
}

export async function commitEditMode(id) {
    const response = await fetchWithLock(`/api/measurements/${id}/edit/commit`, { method: 'POST' });
    return response;
}

export async function rollbackEditMode(id) {
    const response = await fetchWithLock(`/api/measurements/${id}/edit/rollback`, { method: 'POST' });
    return response;
}

export async function updateMeasurementMetadata(id, metadata) {
    const response = await fetchWithLock(`/api/measurements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(metadata)
    });
    return response;
}

export async function deleteMeasurement(id) {
    const response = await fetchWithLock(`/api/measurements/${id}`, { method: 'DELETE' });
    return response;
}

export async function duplicateMeasurement(id) {
    const response = await fetchWithLock(`/api/measurements/${id}/duplicate`, { method: 'POST' });
    return response;
}

export async function addDataPoint(measurementId, pointData) {
    const response = await fetchWithLock(`/api/measurements/${measurementId}/points`, {
        method: 'POST',
        body: JSON.stringify(pointData)
    });
    return response;
}

export async function deleteDataPoint(measurementId, pointId) {
    const response = await fetchWithLock(`/api/measurements/${measurementId}/points/${pointId}`, {
        method: 'DELETE'
    });
    return response;
}

export async function updateDataPoint(measurementId, pointId, pointData) {
    const response = await fetchWithLock(`/api/measurements/${measurementId}/points/${pointId}`, {
        method: 'PUT',
        body: JSON.stringify(pointData)
    });
    return response;
}

export async function fetchRegression(id, type = 'linear') {
    const url = type === 'linear' ? `/api/measurements/${id}/regression` : `/api/measurements/${id}/power-regression`;
    return fetchWithLock(url);
}

export async function fetchReferenceCurves() {
    return fetchWithLock('/api/reference-curves');
}
