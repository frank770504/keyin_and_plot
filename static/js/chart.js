// static/js/chart.js
import { getRegressionData, getSelectedDatasetsForChart } from './api.js';

let chart;
let totalChart;

export function initializeOrUpdateChart(ctx, datasets) {
    const chartData = { datasets: datasets };
    if (chart) {
        chart.data = chartData;
        chart.update();
    } else {
        chart = new Chart(
            ctx,
            {
                type: 'scatter',
                data: chartData,
                options: {
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
    return chart;
}

export function destroyChart() {
    if (chart) {
        chart.destroy();
        chart = null;
    }
}

export function destroyTotalChart() {
    if (totalChart) {
        totalChart.destroy();
        totalChart = null;
    }
}


export async function drawRegression(currentDataset, type) {
    if (!currentDataset || !chart) return;

    try {
        const regressionData = await getRegressionData(currentDataset, type);
        const regressionPoints = regressionData.regression_points;

        let label;
        if (type === 'linear') {
            const { r_squared, slope, intercept } = regressionData;
            const equation = `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`;
            const rSquaredInfo = `R² = ${r_squared.toFixed(2)}`;
            label = `Linear: ${equation}, ${rSquaredInfo}`;
        } else {
            const { r_squared, a, b } = regressionData;
            const equation = `y = ${a.toFixed(2)}x^${b.toFixed(2)}`;
            const rSquaredInfo = `R² = ${r_squared.toFixed(2)}`;
            label = `Power: ${equation}, ${rSquaredInfo}`;
        }

        const newDataset = {
            label: label,
            data: regressionPoints,
            borderColor: type === 'linear' ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)',
            backgroundColor: type === 'linear' ? 'rgba(255, 99, 132, 0.5)' : 'rgba(54, 162, 235, 0.5)',
            type: 'line',
            showLine: true,
            fill: false
        };

        const otherDatasets = chart.data.datasets.filter(d => !d.label.startsWith(type === 'linear' ? 'Linear:' : 'Power:'));
        chart.data.datasets = [...otherDatasets, newDataset];
        chart.update();

    } catch (error) {
        console.error(`Error calculating ${type} regression:`, error);
        alert(error.message);
    }
}

export function clearRegressions() {
    if (!chart) return;
    const originalDataset = chart.data.datasets.filter(d => !d.label.startsWith('Linear:') && !d.label.startsWith('Power:'));
    chart.data.datasets = originalDataset;
    chart.update();
}

export async function drawSelectedDatasetsChart(ctx_all, selectedDatasets) {
    try {
        const chartData = await getSelectedDatasetsForChart(selectedDatasets);
        if (totalChart) {
            totalChart.data = chartData;
            totalChart.update();
        } else {
            totalChart = new Chart(
                ctx_all,
                {
                    type: 'scatter',
                    data: chartData,
                    options: {
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
                                    mode: 'xy',
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
    } catch (error) {
        console.error('Error loading datasets for chart:', error);
        alert(error.message);
    }
}
