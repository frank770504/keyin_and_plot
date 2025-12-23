
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dashboardView = document.getElementById('dashboard-view');
    const editView = document.getElementById('edit-view');
    const datasetList = document.getElementById('dataset-list');
    const createDatasetBtn = document.getElementById('create-dataset-btn');
    const newDatasetNameInput = document.getElementById('new-dataset-name');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const currentDatasetNameH1 = document.getElementById('current-dataset-name');
    const pointsList = document.getElementById('points-list');
    const xInput = document.getElementById('x-input');
    const yInput = document.getElementById('y-input');
    const addPointBtn = document.getElementById('add-point-btn');
    const regressionBtn = document.getElementById('regression-btn');
    const powerRegressionBtn = document.getElementById('power-regression-btn');
    const ctx = document.getElementById('myChart').getContext('2d');
    const drawAllBtn = document.getElementById('draw-all-btn');
    const ctx_all = document.getElementById('totalChart');
    const regressionInfo = document.getElementById('regression-info');

    // --- State ---
    let chart;
    let totalChart;
    let currentDataset = null;

    // --- View Navigation ---
    function showDashboard() {
        editView.style.display = 'none';
        dashboardView.style.display = 'block';
        currentDataset = null;
        if (chart) {
            chart.destroy();
            chart = null;
        }
        regressionInfo.innerHTML = '';
        loadDatasets();
    }

    async function showEditView(datasetName) {
        dashboardView.style.display = 'none';
        editView.style.display = 'block';
        currentDataset = datasetName;
        currentDatasetNameH1.textContent = datasetName;
        if (totalChart) {
            totalChart.destroy();
            totalChart = null;
        }
        if (chart) {
            chart.destroy();
            chart = null;
        }
        regressionInfo.innerHTML = '';
        await loadPointsForCurrentDataset();
    }

    async function drawAllDataset() {
        try {
            const response = await fetch('/api/datasets');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const datasets = await response.json();
            const chartData = { datasets: []
            };
            for (const [index, name] of datasets.entries()) {
                const response = await fetch(`/api/datasets/${name}`);
                if (!response.ok) {
                  throw new Error(`Failed to fetch points for dataset: ${name}`);
                }
                const points = await response.json();
                console.log(`Received ${points.length} points for ${name}`); //Example
                for (const p in points) {
                    console.log(points[p]["x"], points[p]["y"]);
                }

                const inner_dataset = {
                    label: name,
                    data: points,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)'
                };
                chartData.datasets.push(inner_dataset);
            }
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
                console.error('Error loading datasets:', error);
            }
    }

    // --- Charting & Rendering ---
    function initializeOrUpdateChart(datasets) {
        const chartData = { datasets: datasets
        };
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
    }

    function renderPointsList(points) {
        pointsList.innerHTML = '';
        points.forEach(point => {
            const li = document.createElement('li');
            const textSpan = document.createElement('span');
            textSpan.textContent = `(x: ${point.x}, y: ${point.y})`;
            li.appendChild(textSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deletePoint(point.id);
            li.appendChild(deleteBtn);

            pointsList.appendChild(li);
        });
    }

    async function drawRegression(type) {
        if (!currentDataset) return;

        try {
            const url = type === 'linear'
                ? `/api/datasets/${currentDataset}/regression`
                : `/api/datasets/${currentDataset}/power-regression`;

            const regressionResponse = await fetch(url);
            if (!regressionResponse.ok) {
                const errorData = await regressionResponse.json();
                alert(`Error: ${errorData.error}`);
                return;
            }
            const regressionData = await regressionResponse.json();
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

            // Keep existing datasets, but remove old regression line of the same type
            const otherDatasets = chart.data.datasets.filter(d => !d.label.startsWith(type === 'linear' ? 'Linear:' : 'Power:'));
            initializeOrUpdateChart([...otherDatasets, newDataset]);

        } catch (error) {
            console.error(`Error calculating ${type} regression:`, error);
        }
    }

    async function deletePoint(pointId) {
        if (!confirm(`Are you sure you want to delete this point?`)) return;

        try {
            const response = await fetch(`/api/datasets/${currentDataset}/points/${pointId}`, { method: 'DELETE' });
            if (response.ok) {
                await loadPointsForCurrentDataset(); // Refresh the view
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error deleting point:', error);
            alert('An error occurred while deleting the point.');
        }
    }

    async function addPoint() {
        const x = xInput.value;
        const y = yInput.value;
        if (x === '' || y === '' || !currentDataset) {
            alert('Please enter both X and Y values.');
            return;
        }
        try {
            const response = await fetch(`/api/datasets/${currentDataset}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y }),
            });
            if (response.status === 201) {
                xInput.value = '';
                yInput.value = '';
                await loadPointsForCurrentDataset();
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error adding point:', error);
        }
    }

    async function loadPointsForCurrentDataset() {
        if (!currentDataset) return;
        try {
            const response = await fetch(`/api/datasets/${currentDataset}`);
            if (!response.ok) throw new Error('Failed to fetch points');
            const points = await response.json();
            const datasets = [
                {
                    label: currentDataset,
                    data: points,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)'
                }
            ];
            initializeOrUpdateChart(datasets);
            renderPointsList(points);
        } catch (error) {
            console.error('Error loading points:', error);
        }
    }

    async function deleteDataset(name) {
        if (!confirm(`Are you sure you want to delete the dataset "${name}"?`)) return;
        try {
            const response = await fetch(`/api/datasets/${name}`, { method: 'DELETE' });
            if (response.ok) {
                await loadDatasets();
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error deleting dataset:', error);
        }
    }

    async function loadDatasets() {
        try {
            const response = await fetch('/api/datasets');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const datasets = await response.json();
            datasetList.innerHTML = '';
            datasets.forEach(name => {
                const li = document.createElement('li');
                const nameSpan = document.createElement('span');
                nameSpan.textContent = name;
                li.appendChild(nameSpan);
                const controlsDiv = document.createElement('div');
                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'View/Edit';
                viewBtn.onclick = () => showEditView(name);
                controlsDiv.appendChild(viewBtn);
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = () => deleteDataset(name);
                controlsDiv.appendChild(deleteBtn);
                li.appendChild(controlsDiv);
                datasetList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading datasets:', error);
        }
    }

    async function createDataset() {
        const name = newDatasetNameInput.value.trim();
        if (!name) return alert('Please enter a dataset name.');
        try {
            const response = await fetch('/api/datasets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name }),
            });
            if (response.status === 201) {
                newDatasetNameInput.value = '';
                await loadDatasets();
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error creating dataset:', error);
        }
    }

    // --- Event Listeners ---
    createDatasetBtn.addEventListener('click', createDataset);
    backToDashboardBtn.addEventListener('click', showDashboard);
    addPointBtn.addEventListener('click', addPoint);
    regressionBtn.addEventListener('click', () => drawRegression('linear'));
    powerRegressionBtn.addEventListener('click', () => drawRegression('power'));
    drawAllBtn.addEventListener('click', drawAllDataset);

    // --- Initial Load ---
    showDashboard();
});
