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

export async function getSelectedDatasetsForChart(datasets) {
    const chartData = { datasets: [] };
    const colors = [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)',
        'rgba(255, 159, 64, 0.5)'
    ];
    const borderColors = [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
    ];

    for (let i = 0; i < datasets.length; i++) {
        const name = datasets[i];
        const points = await getDatasetPoints(name);
        const inner_dataset = {
            label: name,
            data: points,
            backgroundColor: colors[i % colors.length],
            borderColor: borderColors[i % borderColors.length]
        };
        chartData.datasets.push(inner_dataset);
    }
    return chartData;
}
