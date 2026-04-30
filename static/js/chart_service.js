// static/js/chart_service.js
import { fetchMeasurementData, fetchRegression } from './api.js';

// --- Constants & Configuration ---
const COLORS = [
    'rgba(255, 99, 132, 1)',   // Red
    'rgba(54, 162, 235, 1)',   // Blue
    'rgba(255, 206, 86, 1)',   // Yellow
    'rgba(75, 192, 192, 1)',   // Teal
    'rgba(153, 102, 255, 1)',  // Purple
    'rgba(255, 159, 64, 1)',   // Orange
    'rgba(199, 199, 199, 1)',  // Grey
    'rgba(83, 102, 255, 1)',   // Indigo
    'rgba(40, 167, 69, 1)',    // Green
    'rgba(220, 53, 69, 1)'     // Dark Red
];

const POINT_STYLES = ['circle', 'rect', 'triangle', 'rectRot', 'cross', 'crossRot', 'star', 'line', 'dash'];

// Simple cache for measurement points to avoid redundant API calls
const dataCache = new Map();

export function clearChartCache(id = null) {
    if (id) {
        dataCache.delete(id);
    } else {
        dataCache.clear();
    }
}

// --- Custom KaTeX Plugin ---
const katexChartPlugin = {
    id: 'katexChartPlugin',
    afterUpdate: function(chart) {
        const xTitle = chart.options.scales.x.title.text;
        const yTitle = chart.options.scales.y.title.text;
        const container = chart.canvas.parentElement;

        if (!container) return;

        ['x', 'y'].forEach(axis => {
            let titleDiv = container.querySelector(`.katex-axis-title-${axis}`);
            if (!titleDiv) {
                titleDiv = document.createElement('div');
                titleDiv.className = `katex-axis-title-${axis}`;
                titleDiv.style.position = 'absolute';
                titleDiv.style.pointerEvents = 'none';
                container.appendChild(titleDiv);
            }
            const text = axis === 'x' ? xTitle : yTitle;

            if (titleDiv.getAttribute('data-latex-cache') !== text) {
                titleDiv.innerHTML = text;
                titleDiv.setAttribute('data-latex-cache', text);

                if (typeof renderMathInElement === 'function') {
                    renderMathInElement(titleDiv, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false}
                        ],
                        throwOnError: false
                    });
                }
            }
        });
    },
    afterDraw: function(chart) {
        const container = chart.canvas.parentElement;
        const xDiv = container.querySelector('.katex-axis-title-x');
        const yDiv = container.querySelector('.katex-axis-title-y');

        if (xDiv && chart.scales.x) {
            const xPos = chart.scales.x.left + chart.scales.x.width / 2;
            const yPos = chart.scales.x.bottom + 25;
            xDiv.style.left = `${xPos}px`;
            xDiv.style.top = `${yPos}px`;
            xDiv.style.transform = 'translateX(-50%)';
            xDiv.style.fontSize = '14px';
        }

        if (yDiv && chart.scales.y) {
            const xPos = chart.scales.y.left - 55;
            const yPos = chart.scales.y.top + chart.scales.y.height / 2;
            yDiv.style.left = `${xPos}px`;
            yDiv.style.top = `${yPos}px`;
            yDiv.style.transform = 'translateY(-50%) rotate(-90deg)';
            yDiv.style.fontSize = '14px';
        }
    }
};

// --- Custom Tooltip Handler ---
const externalTooltipHandler = (context) => {
    const {chart, tooltip} = context;
    let tooltipEl = chart.canvas.parentElement.querySelector('div.chartjs-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'chartjs-tooltip';
        tooltipEl.style.background = 'rgba(0, 0, 0, 0.8)';
        tooltipEl.style.borderRadius = '4px';
        tooltipEl.style.color = 'white';
        tooltipEl.style.opacity = 1;
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.transition = 'all .1s ease';
        tooltipEl.style.padding = '8px';
        tooltipEl.style.zIndex = '2000';
        tooltipEl.style.fontSize = '12px';
        chart.canvas.parentElement.appendChild(tooltipEl);
    }

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    if (tooltip.body) {
        const titleLines = tooltip.title || [];
        const bodyLines = tooltip.body.map(b => b.lines);

        let innerHtml = '';

        titleLines.forEach(function(title) {
            innerHtml += '<div style="font-weight: bold; margin-bottom: 4px;">' + title + '</div>';
        });

        bodyLines.forEach(function(body, i) {
            const colors = tooltip.labelColors[i];
            const span = '<span style="background:' + colors.backgroundColor + '; border-color:' + colors.borderColor + '; border-width: 2px; display: inline-block; width: 10px; height: 10px; margin-right: 8px;"></span>';
            innerHtml += '<div style="display: flex; align-items: center;">' + span + body + '</div>';
        });

        tooltipEl.innerHTML = innerHtml;

        if (typeof renderMathInElement === 'function') {
            renderMathInElement(tooltipEl, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }
    }

    const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;

    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.padding = tooltip.opacity > 0 ? (tooltip.options.padding + 'px ' + tooltip.options.padding + 'px') : '0';
};

// --- Main Chart Interface ---

export function initializeOrUpdateChart(ctx, chartDatasets, options = {}) {
    const {
        xAxisType = 'linear',
        yAxisType = 'linear',
        xAxisTitle = '$\\dot{\\gamma}$ (1/s)',
        yAxisTitle = '$\\sigma$ (Pa)'
    } = options;

    return new Chart(ctx, {
        type: 'scatter',
        data: { datasets: chartDatasets },
        plugins: [katexChartPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: 40,
                    left: 60,
                    right: 20,
                    top: 10
                }
            },
            scales: {
                x: {
                    type: xAxisType,
                    position: 'bottom',
                    title: { display: false, text: xAxisTitle },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        callback: function(value) {
                            return xAxisType === 'logarithmic' ? value.toExponential(0) : value;
                        }
                    }
                },
                y: {
                    type: yAxisType,
                    title: { display: false, text: yAxisTitle },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        callback: function(value) {
                            return yAxisType === 'logarithmic' ? value.toExponential(0) : value;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'xy'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: externalTooltipHandler
                },
                zoom: {
                    pan: { enabled: true, mode: 'xy' },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                    }
                }
            }
        }
    });
}

export function destroyChart(chartInstance) {
    if (chartInstance) {
        const container = chartInstance.canvas.parentElement;
        if (container) {
            ['x', 'y'].forEach(axis => {
                const titleDiv = container.querySelector(`.katex-axis-title-${axis}`);
                if (titleDiv) titleDiv.remove();
            });
        }
        chartInstance.destroy();
    }
}

export async function getSelectedMeasurementsForChart(measurementIds, options = {}) {
    const { includeLinear = false, includePower = true } = options;
    const chartData = { datasets: [] };

    for (let i = 0; i < measurementIds.length; i++) {
        const id = measurementIds[i];
        let measurementData;

        // Caching logic
        if (dataCache.has(id)) {
            measurementData = dataCache.get(id);
        } else {
            measurementData = await fetchMeasurementData(id);
            dataCache.set(id, measurementData);
        }

        const pointsArray = measurementData.points;
        const logicalId = measurementData.original_id || measurementData.id;
        const displayName = `${measurementData.liquid_name} - ${logicalId}`;
        const color = COLORS[i % COLORS.length];
        const pointStyle = POINT_STYLES[i % POINT_STYLES.length];

        // Add raw data points
        chartData.datasets.push({
            label: displayName,
            data: pointsArray.map(p => ({ x: p.shear_rate, y: p.shear_stress })),
            backgroundColor: color.replace('1)', '0.5)'),
            borderColor: color,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointStyle: pointStyle,
            type: 'scatter'
        });

        // Fetch Regression Data
        if (includePower) {
            try {
                const reg = await fetchRegression(id, 'power');
                chartData.datasets.push(createRegressionDataset(displayName, reg, 'power', color));
            } catch (e) { console.warn(`Power reg failed for ${displayName}`, e); }
        }

        if (includeLinear) {
            try {
                const reg = await fetchRegression(id, 'linear');
                chartData.datasets.push(createRegressionDataset(displayName, reg, 'linear', color));
            } catch (e) { console.warn(`Linear reg failed for ${displayName}`, e); }
        }
    }
    return chartData;
}

function createRegressionDataset(name, regData, type, color) {
    const points = regData.regression_points.map(p => ({ x: p.shear_rate, y: p.shear_stress }));
    let label;
    const r2 = regData.r_squared.toFixed(3);

    if (type === 'linear') {
        const { slope, intercept } = regData;
        label = `Linear (${name}): $\\sigma = ${slope.toFixed(3)}\\dot{\\gamma} ${intercept >= 0 ? '+' : ''} ${intercept.toFixed(3)}, R^2=${r2}$`;
    } else {
        const { a, b } = regData;
        label = `Power (${name}): $\\sigma = ${a.toFixed(3)}\\dot{\\gamma}^{${b.toFixed(3)}}, R^2=${r2}$`;
    }

    return {
        label: label,
        data: points,
        borderColor: color,
        borderWidth: 2,
        borderDash: type === 'linear' ? [10, 5] : [5, 5],
        backgroundColor: 'rgba(0,0,0,0)',
        type: 'line',
        showLine: true,
        fill: false,
        pointRadius: 0,
        hitRadius: 15,      // Increased for easier hovering
        pointHitRadius: 15, // Ensure points (even if radius 0) are detectable
        tension: 0.1 // Slight smoothing
    };
}
