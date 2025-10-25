document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const datasetList = document.getElementById('dataset-list');
    const createDatasetBtn = document.getElementById('create-dataset-btn');
    const newDatasetNameInput = document.getElementById('new-dataset-name');

    /**
     * Fetches dataset names from the API and renders them in the list.
     */
    async function loadDatasets() {
        try {
            const response = await fetch('/api/datasets');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const datasets = await response.json();

            datasetList.innerHTML = '';
            datasets.forEach(name => {
                const li = document.createElement('li');
                li.textContent = name;
                datasetList.appendChild(li);
            });

        } catch (error) {
            console.error('Error loading datasets:', error);
            datasetList.innerHTML = '<li>Error loading datasets.</li>';
        }
    }

    /**
     * Sends a request to create a new dataset and reloads the list on success.
     */
    async function createDataset() {
        const name = newDatasetNameInput.value.trim();
        if (!name) {
            alert('Please enter a dataset name.');
            return;
        }

        try {
            const response = await fetch('/api/datasets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name }),
            });

            if (response.status === 201) { // 201 Created
                newDatasetNameInput.value = ''; // Clear the input
                await loadDatasets(); // Refresh the list
            } else {
                // Display error message from the server
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

    // --- Initial Load ---
    loadDatasets();
});
