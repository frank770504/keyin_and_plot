// static/js/chart_service.js
import { getDatasetPoints, getRegressionData } from './api.js';

export function initializeOrUpdateChart(ctx, datasets) {
    return new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'X' }
                },
                y: {
                    title: { display: true, text: 'Y' }
                }
            },
            plugins: {
                tooltip: {
                    enabled: true
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'xy'
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy',
                    }
                }
            }
        }
    });
}

export function destroyChart(chartInstance) {
    if (chartInstance) {
        chartInstance.destroy();
    }
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
        const points = await getDatasetPoints(name); // Now fetch just points, API returns object
        // Wait, getDatasetPoints in api.js returns { points: [...], date: ..., serial_id: ... }
        // The old code assumed it returned an array? No, looking at old main.js, loadActiveDatasetData handled the object.
        // But getSelectedDatasetsForChart in old api.js used getDatasetPoints.
        // Let's check old api.js getDatasetPoints implementation I just overwrote.
        // It returned response.json().
        // In app.py get_dataset returns object.
        // So `points` here is the object. The array is points.points.

        const pointsArray = points.points;
        const colorIndex = i % colors.length;

        // Add raw data points
        chartData.datasets.push({
            label: name,
            data: pointsArray,
            backgroundColor: colors[colorIndex],
            borderColor: borderColors[colorIndex],
            pointRadius: 3,
            type: 'scatter'
        });

        // Fetch and add power law regression data
        try {
            const regressionData = await getRegressionData(name, 'power');
            const regressionPoints = regressionData.regression_points;

            let label;
            const { r_squared, a, b } = regressionData;
            if (r_squared !== undefined && a !== undefined && b !== undefined) {
                const equation = `y = ${a.toFixed(2)}x^${b.toFixed(2)}`;
                const rSquaredInfo = `R² = ${r_squared.toFixed(2)}`;
                label = `Power: ${equation}, ${rSquaredInfo}`;
            } else {
                label = `Power Regression for ${name}`;
            }

            chartData.datasets.push({
                label: label,
                data: regressionPoints,
                borderColor: borderColors[colorIndex], // Use same color but dashed
                borderDash: [5, 5],
                backgroundColor: 'rgba(0,0,0,0)', // Transparent fill
                type: 'line',
                showLine: true,
                fill: false,
                pointRadius: 0
            });
        } catch (error) {
            console.warn(`Could not get power regression for dataset ${name}:`, error.message);
        }
    }
    return chartData;
}
