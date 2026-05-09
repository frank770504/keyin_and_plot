// static/js/chart_service.js
import { fetchMeasurementData, fetchRegression } from './api.js';

// --- Constants & Configuration ---
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;
let HUE_START = 0.35; // Starting hue

const POINT_STYLES = ['circle', 'rect', 'triangle', 'rectRot', 'cross', 'crossRot', 'star'];

/**
 * Converts HSV color to RGBA string.
 * @param {number} h - Hue (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value (0-1)
 * @param {number} a - Alpha (0-1)
 * @returns {string} rgba string
 */
function hsvToRgba(h, s, v, a = 1) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

/**
 * Generates a visually distinct color using the Golden Ratio.
 * @param {number} index - Index of the measurement
 * @param {number} alpha - Alpha value
 * @returns {string} rgba string
 */
function getDynamicColor(index, alpha = 1) {
    const h = (HUE_START + index * GOLDEN_RATIO_CONJUGATE) % 1;
    return hsvToRgba(h, 0.75, 0.9, alpha); // Balanced: S=0.5, V=0.9
}

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
    afterLayout: function(chart) {
        // Dynamically adjust padding to fit tick labels + title gap
        const padding = chart.options.layout.padding;
        const yWidth = chart.scales.y.width;
        const xHeight = chart.scales.x.height;

        // Target padding: scale size (ticks/labels) + fixed gap for KaTeX title
        // We ensure a minimum padding even if scales are small
        const targetLeft = Math.max(60, yWidth + 30);
        const targetBottom = Math.max(40, xHeight + 30);

        // Only update if change is significant to avoid resize loops
        if (Math.abs(padding.left - targetLeft) > 5 || Math.abs(padding.bottom - targetBottom) > 5) {
            padding.left = targetLeft;
            padding.bottom = targetBottom;
            // Use setTimeout to avoid 'afterLayout' recursion during the same tick
            setTimeout(() => {
                if (chart && chart.canvas) chart.update('none');
            }, 0);
        }
    },
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
            // Position 15px below the bottom of the scale (labels)
            const yPos = chart.scales.x.bottom + 15;
            xDiv.style.left = `${xPos}px`;
            xDiv.style.top = `${yPos}px`;
            xDiv.style.transform = 'translateX(-50%)';
            xDiv.style.fontSize = '14px';
            xDiv.style.display = 'inline-block';
        }

        if (yDiv && chart.scales.y) {
            // Position 15px to the left of the leftmost edge of the labels
            // scales.y.left is the axis line; scales.y.width is everything to the left of it
            const xPos = (chart.scales.y.left - chart.scales.y.width) - 15;
            const yPos = chart.scales.y.top + chart.scales.y.height / 2;
            yDiv.style.left = `${xPos}px`;
            yDiv.style.top = `${yPos}px`;
            yDiv.style.transform = 'translateY(-50%) rotate(-90deg)';
            yDiv.style.transformOrigin = 'right center';
            yDiv.style.fontSize = '14px';
            yDiv.style.display = 'inline-block';
            yDiv.style.whiteSpace = 'nowrap';
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

// Helper to format tick labels to prevent them from becoming too long
function formatTickLabel(value, axisType) {
    if (axisType === 'logarithmic') return value.toExponential(0);
    if (value === 0) return '0';
    if (Math.abs(value) >= 1e5 || Math.abs(value) <= 1e-4) return value.toExponential(2);
    // Limit to 4 significant digits to prevent long decimals squeezing the chart
    return parseFloat(value.toPrecision(4)).toString();
}

// Helper to determine which axis to interact with based on cursor position
const getInteractionAxis = (context) => {
    if (!context || !context.chart || !context.event) return 'xy';
    const {chart, event} = context;
    
    let x, y;
    // Native event (e.g. wheel)
    if (event.offsetX !== undefined && event.offsetY !== undefined) {
        x = event.offsetX;
        y = event.offsetY;
    } 
    // Hammer event (e.g. pan/pinch)
    else if (event.center) {
        const rect = chart.canvas.getBoundingClientRect();
        x = event.center.x - rect.left;
        y = event.center.y - rect.top;
    } else {
        return 'xy';
    }

    // Check if cursor is over a scale
    for (const scale of Object.values(chart.scales)) {
        if (x >= scale.left && x <= scale.right && y >= scale.top && y <= scale.bottom) {
            return scale.axis;
        }
    }
    
    return 'xy'; // Default to both axes if in the main chart area
};

export function initializeOrUpdateChart(ctx, chartDatasets, options = {}) {
    const {
        xAxisType = 'linear',
        yAxisType = 'linear',
        xAxisTitle = '$\\dot{\\gamma}$ (1/s)',
        yAxisTitle = '$\\sigma$ (Pa)',
        xMin = null,
        xMax = null,
        yMin = null,
        yMax = null
    } = options;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                bottom: 35, // Reduced from 40
                left: 55,   // Reduced from 60
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
                        return formatTickLabel(value, xAxisType);
                    }
                }
            },
            y: {
                type: yAxisType,
                title: { display: false, text: yAxisTitle },
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    callback: function(value) {
                        return formatTickLabel(value, yAxisType);
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
                pan: { 
                    enabled: true, 
                    mode: getInteractionAxis 
                },
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    mode: getInteractionAxis,
                }
            }
        }
    };

    if (xMin !== null) chartOptions.scales.x.min = xMin;
    if (xMax !== null) chartOptions.scales.x.max = xMax;
    if (yMin !== null) chartOptions.scales.y.min = yMin;
    if (yMax !== null) chartOptions.scales.y.max = yMax;

    return new Chart(ctx, {
        type: 'scatter',
        data: { datasets: chartDatasets },
        plugins: [katexChartPlugin],
        options: chartOptions
    });
}

export function destroyChart(chartInstance) {
    if (chartInstance && chartInstance.canvas) {
        const container = chartInstance.canvas.parentElement;
        if (container) {
            // Remove titles from the current container
            ['x', 'y'].forEach(axis => {
                const titleDiv = container.querySelector(`.katex-axis-title-${axis}`);
                if (titleDiv) titleDiv.remove();
            });
        }
        chartInstance.destroy();
    }
}

export async function getSelectedMeasurementsForChart(measurementIds, options = {}) {
    const { includeLinear = false, includePower = true, customCurves = [] } = options;
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
        const logicalId = measurementData.original_id || measurementData.pkey;
        const displayName = `${measurementData.formula_id} - ${logicalId}`;
        const color = getDynamicColor(i);
        const pointStyle = POINT_STYLES[i % POINT_STYLES.length];

        // Add raw data points
        chartData.datasets.push({
            label: displayName,
            data: pointsArray.map(p => ({ x: p.shear_rate, y: p.shear_stress })),
            backgroundColor: getDynamicColor(i, 0.5),
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

    if (customCurves && customCurves.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;

        if (chartData.datasets.length > 0) {
            chartData.datasets.forEach(ds => {
                if (ds.type === 'scatter') {
                    ds.data.forEach(p => {
                        if (p.x < minX) minX = p.x;
                        if (p.x > maxX) maxX = p.x;
                    });
                }
            });
        }

        if (minX === Infinity) minX = 0.1;
        if (maxX === -Infinity) maxX = 100;

        if (minX <= 0) minX = 0.001;

        customCurves.forEach(curve => {
            const points = [];
            const steps = 100;
            const logMin = Math.log(minX);
            const logMax = Math.log(maxX);

            for (let i = 0; i <= steps; i++) {
                const x = Math.exp(logMin + (logMax - logMin) * (i / steps));
                let y;
                if (curve.type === 'linear') {
                    y = curve.param1 * x + curve.param2;
                } else {
                    y = curve.param1 * Math.pow(x, curve.param2);
                }
                points.push({ x, y });
            }

            let label;
            if (curve.type === 'linear') {
                label = `${curve.name}: $\\sigma = ${curve.param1.toFixed(3)}\\dot{\\gamma} ${curve.param2 >= 0 ? '+' : '-'}${Math.abs(curve.param2).toFixed(3)}$`;
            } else {
                label = `${curve.name}: $\\sigma = ${curve.param1.toFixed(3)}\\dot{\\gamma}^{${curve.param2.toFixed(3)}}$`;
            }

            chartData.datasets.push({
                label: label,
                data: points,
                borderColor: curve.color,
                borderWidth: 2,
                borderDash: curve.type === 'linear' ? [10, 5] : [5, 5],
                backgroundColor: 'rgba(0,0,0,0)',
                type: 'line',
                showLine: true,
                fill: false,
                pointRadius: 0,
                hitRadius: 15,
                pointHitRadius: 15,
                tension: 0.1
            });
        });
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
