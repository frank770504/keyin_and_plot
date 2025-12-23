// static/js/api.js

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

export async function getDatasetPoints(datasetName) {
    const response = await fetch(`/api/datasets/${datasetName}`);
    if (!response.ok) {
        throw new Error('Failed to fetch points');
    }
    return await response.json();
}

export async function addPoint(datasetName, x, y) {
    const response = await fetch(`/api/datasets/${datasetName}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
    });
    if (response.status !== 201) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
}

export async function deletePoint(datasetName, pointId) {
    const response = await fetch(`/api/datasets/${datasetName}/points/${pointId}`, { method: 'DELETE' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
    }
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

export async function getAllDatasetsForChart() {
    const datasets = await getDatasets();
    const chartData = { datasets: [] };
    for (const name of datasets) {
        const points = await getDatasetPoints(name);
        const inner_dataset = {
            label: name,
            data: points,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)'
        };
        chartData.datasets.push(inner_dataset);
    }
    return chartData;
}
