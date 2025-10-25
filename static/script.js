document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const datasetList = document.getElementById('dataset-list');
    const createDatasetBtn = document.getElementById('create-dataset-btn');
    const newDatasetNameInput = document.getElementById('new-dataset-name');

    /**
     * Deletes a dataset after confirmation.
     * @param {string} name The name of the dataset to delete.
     */
    async function deleteDataset(name) {
        if (!confirm(`Are you sure you want to delete the dataset "${name}"?`)) {
            return; // User cancelled the action
        }

        try {
            const response = await fetch(`/api/datasets/${name}`, { method: 'DELETE' });

            if (response.ok) {
                await loadDatasets(); // Refresh the list to show the item has been removed
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error deleting dataset:', error);
            alert('An error occurred while deleting the dataset.');
        }
    }

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

                const nameSpan = document.createElement('span');
                nameSpan.textContent = name;
                li.appendChild(nameSpan);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'delete-btn'; // For potential styling
                deleteBtn.onclick = () => deleteDataset(name);
                li.appendChild(deleteBtn);

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

    // --- Initial Load ---
    loadDatasets();
});
