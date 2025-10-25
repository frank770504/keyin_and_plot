
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
    const ctx = document.getElementById('myChart').getContext('2d');

    // --- State ---
    let chart; // Holds the chart instance
    let currentDataset = null; // The name of the dataset being viewed

    // --- View Navigation ---
    function showDashboard() {
        editView.style.display = 'none';
        dashboardView.style.display = 'block';
        currentDataset = null;
        // Destroy the chart instance when going back to the dashboard to free up resources
        if (chart) {
            chart.destroy();
            chart = null;
        }
        loadDatasets();
    }

    async function showEditView(datasetName) {
        dashboardView.style.display = 'none';
        editView.style.display = 'block';
        currentDataset = datasetName;
        currentDatasetNameH1.textContent = datasetName;

        // Fetch the data for the selected dataset and display it
        await loadPointsForCurrentDataset();
    }

    // --- Charting & Rendering ---
    function initializeOrUpdateChart(points) {
        const chartData = {
            datasets: [{
                label: currentDataset,
                data: points,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
            }]
        };

        if (chart) {
            // If a chart instance already exists, just update its data
            chart.data = chartData;
            chart.update();
        } else {
            // Otherwise, create a new chart instance
            chart = new Chart(ctx, {
                type: 'scatter',
                data: chartData,
                options: {
                    scales: {
                        x: { type: 'linear', position: 'bottom', title: { display: true, text: 'X' } },
                        y: { title: { display: true, text: 'Y' } }
                    }
                }
            });
        }
    }

    function renderPointsList(points) {
        pointsList.innerHTML = ''; // Clear previous list
        points.forEach((point, index) => {
            const li = document.createElement('li');
            li.textContent = `(x: ${point.x}, y: ${point.y})`;
            // A delete button for each point will be added in a later step
            pointsList.appendChild(li);
        });
    }

    // --- API Communication ---
    async function loadPointsForCurrentDataset() {
        if (!currentDataset) return;
        try {
            const response = await fetch(`/api/datasets/${currentDataset}`);
            if (!response.ok) throw new Error('Failed to fetch points for dataset');
            const points = await response.json();

            initializeOrUpdateChart(points);
            renderPointsList(points);

        } catch (error) {
            console.error('Error loading points:', error);
            pointsList.innerHTML = '<li>Error loading points.</li>';
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

    // --- Initial Load ---
    showDashboard();
});
