document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dashboardView = document.getElementById('dashboard-view');
    const editView = document.getElementById('edit-view');
    const datasetList = document.getElementById('dataset-list');
    const createDatasetBtn = document.getElementById('create-dataset-btn');
    const newDatasetNameInput = document.getElementById('new-dataset-name');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const currentDatasetNameH1 = document.getElementById('current-dataset-name');

    // --- View Navigation ---
    function showDashboard() {
        editView.style.display = 'none';
        dashboardView.style.display = 'block';
        loadDatasets();
    }

    function showEditView(datasetName) {
        dashboardView.style.display = 'none';
        editView.style.display = 'block';
        currentDatasetNameH1.textContent = datasetName;
        // In the next step, we will load the points and draw the chart here.
    }

    // --- API Communication ---

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
            alert('An error occurred while deleting the dataset.');
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
            datasetList.innerHTML = '<li>Error loading datasets.</li>';
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
            alert('An error occurred while creating the dataset.');
        }
    }

    // --- Event Listeners ---
    createDatasetBtn.addEventListener('click', createDataset);
    backToDashboardBtn.addEventListener('click', showDashboard);

    // --- Initial Load ---
    showDashboard(); // Start by showing the dashboard
});