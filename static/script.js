document.addEventListener('DOMContentLoaded', () => {
    const datasetList = document.getElementById('dataset-list');

    /**
     * Fetches dataset names from the API and renders them in the list.
     */
    async function loadDatasets() {
        try {
            const response = await fetch('/api/datasets');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const datasets = await response.json();

            // Clear the "Loading..." message
            datasetList.innerHTML = '';

            // Populate the list with dataset names
            datasets.forEach(name => {
                const li = document.createElement('li');
                li.textContent = name;
                datasetList.appendChild(li);
            });

        } catch (error) {
            console.error('Error loading datasets:', error);
            datasetList.innerHTML = '<li>Error loading datasets. See console for details.</li>';
        }
    }

    // Initial load of the application
    loadDatasets();
});
