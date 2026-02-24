// static/js/chart_service.js
import { getDatasetPoints, getRegressionData } from './api.js';

const katexChartPlugin = {
    id: 'katexChartPlugin',
    afterUpdate: function(chart) {
        const xTitle = chart.options.scales.x.title.text;
        const yTitle = chart.options.scales.y.title.text;
        const container = chart.canvas.parentElement;

        if (!container) return;

        // Ensure LaTeX title divs exist
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

            // Only re-render if the text has changed to save performance
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
                } else if (typeof katex !== 'undefined') {
                    // Fallback for pure math strings if auto-render is missing
                    katex.render(text.replace(/\$/g, ''), titleDiv, { throwOnError: false });
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
            const yPos = chart.scales.x.bottom + 25; // increased offset for padding
            xDiv.style.left = `${xPos}px`;
            xDiv.style.top = `${yPos}px`;
            xDiv.style.transform = 'translateX(-50%)';
            xDiv.style.fontSize = '14px';
        }

        if (yDiv && chart.scales.y) {
            const xPos = chart.scales.y.left - 55; // increased offset left
            const yPos = chart.scales.y.top + chart.scales.y.height / 2;
            yDiv.style.left = `${xPos}px`;
            yDiv.style.top = `${yPos}px`;
            yDiv.style.transform = 'translateY(-50%) rotate(-90deg)';
            yDiv.style.fontSize = '14px';
        }
    }
};

const externalTooltipHandler = (context) => {
    // Tooltip Element
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

    // Hide if no tooltip
    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    // Set Text
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

        // Render LaTeX
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

    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
};

export function initializeOrUpdateChart(ctx, datasets) {
    return new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        plugins: [katexChartPlugin],
        options: {
            maintainAspectRatio: true,
            layout: {
                padding: {
                    bottom: 40, // Space for X axis title
                    left: 50,   // Space for Y axis title
                    right: 20,
                    top: 10
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: false, text: '$\\dot{\\gamma}$ (1/s)' } // Set display to false, plugin handles it
                },
                y: {
                    title: { display: false, text: '$\\sigma$ (Pa)' }
                }
            },
            plugins: {
                legend: {
                    display: false // Disable default legend
                },
                tooltip: {
                    enabled: false, // Disable default tooltip
                    external: externalTooltipHandler
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
            data: pointsArray.map(p => ({ x: p.shear_rate, y: p.shear_stress })),
            backgroundColor: colors[colorIndex],
            borderColor: borderColors[colorIndex],
            pointRadius: 3,
            type: 'scatter'
        });

        // Fetch and add power law regression data
        try {
            const regressionData = await getRegressionData(name, 'power');
            const regressionPoints = regressionData.regression_points.map(p => ({ x: p.shear_rate, y: p.shear_stress }));

            let label;
            const { r_squared, a, b } = regressionData;
            if (r_squared !== undefined && a !== undefined && b !== undefined) {
                const equation = `$\\sigma = ${a.toFixed(3)}\\,\\dot{\\gamma}^{${b.toFixed(3)}}$`;
                const rSquaredInfo = `$R^2 = ${r_squared.toFixed(3)}$`;
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
