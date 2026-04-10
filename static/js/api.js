// static/js/api.js

export async function startEdit(name) {
    const url = `/api/datasets/${name}/edit/start`;

    const response = await fetch(url, { method: 'POST' });
    if (response.status === 409) {
        return { conflict: true, data: await response.json() };
    }
    if (!response.ok) throw new Error('Failed to start edit mode');
    return await response.json();
}

export async function duplicateDataset(name) {
    const response = await fetch(`/api/datasets/${name}/duplicate`, { method: 'POST' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate dataset');
    }
    return await response.json();
}

export async function commitEdit(name) {
    const response = await fetch(`/api/datasets/${name}/edit/commit`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to commit changes');
    return await response.json();
}

export async function rollbackEdit(name) {
    const response = await fetch(`/api/datasets/${name}/edit/rollback`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to rollback changes');
    return await response.json();
}

export async function getDatasets() {
    const response = await fetch('/api/datasets');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export async function createDataset(name) {
    const response = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name }),
    });
    if (response.status !== 201) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
}

export async function deleteDataset(name) {
    const response = await fetch(`/api/datasets/${name}`, { method: 'DELETE' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
}

export async function updateDataset(name, data) {
    const response = await fetch(`/api/datasets/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
}

export async function getDatasetPoints(datasetName) {
    const response = await fetch(`/api/datasets/${datasetName}`);
    if (!response.ok) {
        throw new Error('Failed to fetch points');
    }
    return await response.json();
}

export async function addPoint(datasetName, N, eta, torque) {
    const response = await fetch(`/api/datasets/${datasetName}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ N, eta, torque }),
    });
    if (response.status !== 201) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
    return await response.json();
}

export async function deletePoint(datasetName, pointId) {
    const response = await fetch(`/api/datasets/${datasetName}/points/${pointId}`, { method: 'DELETE' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
}

export async function updatePoint(datasetName, pointId, N, eta, torque) {
    const response = await fetch(`/api/datasets/${datasetName}/points/${pointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ N, eta, torque }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
    return await response.json();
}

export async function getRegressionData(datasetName, type) {
    const url = type === 'linear'
        ? `/api/datasets/${datasetName}/regression`
        : `/api/datasets/${datasetName}/power-regression`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
    return await response.json();
}