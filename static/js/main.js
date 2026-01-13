import { getDatasets, createDataset, deleteDataset, getDatasetPoints, addPoint, deletePoint, getRegressionData, getSelectedDatasetsForChart, updatePoint, updateDataset } from './api.js';
import { initializeOrUpdateChart, destroyChart } from './chart.js';
import { FloatingWindow } from './floating_window.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let activeDataset = null;
    let activeChart = null;
    let comparisonChart = null;
    let allDatasets = []; // Store all datasets for filtering

    // --- DOM Elements ---
    const elements = {
        // Left Column
        datasetList: document.getElementById('dataset-list'),
        datasetSearchInput: document.getElementById('dataset-search'), // Search Input
        newDatasetNameInput: document.getElementById('new-dataset-name'),
        createDatasetBtn: document.getElementById('create-dataset-btn'),

        // Center Column
        centerColumn: document.getElementById('center-column'), // Added reference
        activeDatasetName: document.getElementById('active-dataset-name'),
        datasetDateInput: document.getElementById('dataset-date'),
        datasetSerialIdInput: document.getElementById('dataset-serial-id'),
        pointsTableBody: document.querySelector('#points-table tbody'),
        addRowBtn: document.getElementById('add-row-btn'),
        openAnalysisBtn: document.getElementById('open-analysis-btn'), // New button

        // Floating Window
        floatingWindow: document.getElementById('floating-chart-window'),
        windowHeader: document.getElementById('chart-window-header'),
        closeWindowBtn: document.getElementById('close-chart-window'),
        activeChartCanvas: document.getElementById('active-chart').getContext('2d'),
        regressionBtn: document.getElementById('regression-btn'),
        powerRegressionBtn: document.getElementById('power-regression-btn'),
        clearRegressionBtn: document.getElementById('clear-regression-btn'),


        // Right Column
        comparisonSearchInput: document.getElementById('comparison-search'), // Comparison Search
        datasetSelector: document.getElementById('dataset-selector'),
        drawSelectedBtn: document.getElementById('draw-selected-btn'),
        comparisonChartCanvas: document.getElementById('comparison-chart').getContext('2d'),

        // Collapse Buttons / Drag Handle
        collapseLeftBtn: document.getElementById('collapse-left'),
        dragHandle: document.getElementById('drag-handle'),
    };

    // --- Functions ---
    // --- Drag Logic ---
    let isDragging = false;

    function startDrag(e) {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        elements.dragHandle.classList.add('dragging');
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
        // Prevent text selection during drag
        e.preventDefault();
    }

    function handleDrag(e) {
        if (!isDragging) return;

        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const leftColumn = document.getElementById('left-column');
        const leftColumnWidth = leftColumn.getBoundingClientRect().width;

        // Calculate new width for the center column
        // We subtract the left column width from the mouse X position
        let newCenterWidth = e.clientX - leftColumnWidth;

        // Constraints
        const minCenterWidth = 450;
        const maxCenterWidth = containerRect.width - leftColumnWidth - 200; // Leave space for right column

        if (newCenterWidth < minCenterWidth) newCenterWidth = minCenterWidth;
        if (newCenterWidth > maxCenterWidth) newCenterWidth = maxCenterWidth;

        document.getElementById('center-column').style.width = `${newCenterWidth}px`;

        // Resize charts to fit new container dimensions
        if (activeChart) activeChart.resize();
        if (comparisonChart) comparisonChart.resize();
    }

    function stopDrag() {
        isDragging = false;
        document.body.style.cursor = '';
        elements.dragHandle.classList.remove('dragging');
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    function toggleCenterColumn(show) {
        const displayValue = show ? 'flex' : 'none';
        const gutterDisplay = show ? 'block' : 'none';

        if (elements.centerColumn.style.display !== displayValue) {
            elements.centerColumn.style.display = displayValue;
            elements.dragHandle.style.display = gutterDisplay;

            // Allow layout to update before resizing charts
            setTimeout(() => {
                if (activeChart) activeChart.resize();
                if (comparisonChart) comparisonChart.resize();
            }, 0);
        }
    }

    // Initialize Floating Window
    const analysisWindow = new FloatingWindow(
        'floating-chart-window',
        'chart-window-header',
        'close-chart-window',
        () => {
            if (activeChart) activeChart.resize();
        }
    );

    // --- Data Loading and Rendering ---
    async function loadAndRenderDatasets() {
        try {
            const datasets = await getDatasets();
            allDatasets = datasets; // Save to state
            renderDatasetList(datasets);
            populateDatasetSelector(datasets);
        } catch (error) {
            console.error('Error loading datasets:', error);
        }
    }

    function handleDatasetSearch() {
        const searchTerm = elements.datasetSearchInput.value.toLowerCase();
        const filteredDatasets = allDatasets.filter(name => name.toLowerCase().includes(searchTerm));
        renderDatasetList(filteredDatasets);
    }

    function handleComparisonSearch() {
        const searchTerm = elements.comparisonSearchInput.value.toLowerCase();
        const filteredDatasets = allDatasets.filter(name => name.toLowerCase().includes(searchTerm));
        populateDatasetSelector(filteredDatasets);
    }

    function renderDatasetList(datasets) {
        elements.datasetList.innerHTML = '';
        datasets.forEach(name => {
            const li = document.createElement('li');
            li.addEventListener('click', () => setActiveDataset(name));

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            li.appendChild(nameSpan);

            if (name === activeDataset) {
                li.classList.add('active');
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteDataset(name);
            });
            li.appendChild(deleteBtn);

            elements.datasetList.appendChild(li);
        });
    }

    async function handleDeleteDataset(name) {
        if (confirm(`Are you sure you want to delete the dataset "${name}"?`)) {
            try {
                await deleteDataset(name);
                if (activeDataset === name) {
                    activeDataset = null;
                    toggleCenterColumn(false); // Hide the column
                    elements.activeDatasetName.textContent = 'No Dataset Selected';
                    elements.datasetDateInput.value = ''; // Clear date
                    elements.datasetSerialIdInput.value = ''; // Clear serial ID
                    elements.pointsTableBody.innerHTML = '';
                    if (activeChart) {
                        destroyChart(activeChart);
                        activeChart = null;
                    }
                }
                loadAndRenderDatasets();
            } catch (error) {
                alert(error.message);
            }
        }
    }

    function populateDatasetSelector(datasets) {
        elements.datasetSelector.innerHTML = '';
        datasets.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            elements.datasetSelector.appendChild(option);
        });
    }

    async function setActiveDataset(name) {
        if (activeDataset === name) {
            // Toggle off: if already active, deselect it
            activeDataset = null;
            toggleCenterColumn(false);
            elements.activeDatasetName.textContent = 'No Dataset Selected';
        } else {
            // Select new dataset
            activeDataset = name;
            toggleCenterColumn(true);
            elements.activeDatasetName.textContent = name;
            loadActiveDatasetData();
        }
        renderDatasetList(await getDatasets());
    }

    async function loadActiveDatasetData() {
        if (!activeDataset) return;

        try {
            // Updated to handle object response { points: [], date: "...", serial_id: "..." }
            const data = await getDatasetPoints(activeDataset);
            const points = data.points;

            // Set metadata
            elements.datasetDateInput.value = data.date || '';
            elements.datasetSerialIdInput.value = data.serial_id || '';

            renderPointsTable(points);
            renderActiveChart(points);
        } catch (error) {
            console.error(`Error loading data for ${activeDataset}:`, error);
        }
    }

    function renderPointsTable(points) {
        elements.pointsTableBody.innerHTML = '';
        points.forEach(point => {
            const tr = createTableRow(point.id, point.x, point.y);
            elements.pointsTableBody.appendChild(tr);
        });
    }

    function createTableRow(id, x, y) {
        const tr = document.createElement('tr');
        if (id) tr.dataset.id = id;

        const tdX = document.createElement('td');
        const inputX = document.createElement('input');
        inputX.type = 'number';
        inputX.value = x !== undefined ? x : '';
        inputX.placeholder = 'X';
        inputX.dataset.field = 'x';
        tdX.appendChild(inputX);

        const tdY = document.createElement('td');
        const inputY = document.createElement('input');
        inputY.type = 'number';
        inputY.value = y !== undefined ? y : '';
        inputY.placeholder = 'Y';
        inputY.dataset.field = 'y';
        tdY.appendChild(inputY);

        const tdAction = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        // Use a generic delete handler
        deleteBtn.addEventListener('click', () => {
            if (id) {
                handleDeletePoint(id);
            } else {
                tr.remove(); // Remove unsaved row
            }
        });
        tdAction.appendChild(deleteBtn);

        tr.appendChild(tdX);
        tr.appendChild(tdY);
        tr.appendChild(tdAction);

        return tr;
    }

    function handleTableAddRow() {
        const tr = createTableRow(null, undefined, undefined);
        elements.pointsTableBody.appendChild(tr);
        // Focus on the first input
        tr.querySelector('input[data-field="x"]').focus();
    }

    async function handleTableInput(e) {
        if (e.target.tagName !== 'INPUT') return;

        const input = e.target;
        const tr = input.closest('tr');
        const id = tr.dataset.id;
        const xInput = tr.querySelector('input[data-field="x"]');
        const yInput = tr.querySelector('input[data-field="y"]');

        const xVal = xInput.value;
        const yVal = yInput.value;

        // If both empty, do nothing (or maybe delete if existing?)
        if (xVal === '' && yVal === '') return;

        if (id) {
            // Update existing point
            // Only update if the changed value is valid
            if (input.value === '') return; // Don't update with empty string

            try {
                await updatePoint(activeDataset, id, xVal, yVal);
                // No need to reload everything, silent update
                // But we should update the chart and list to reflect changes
                // Doing a full reload is safest for consistency
                loadActiveDatasetData();
            } catch (error) {
                console.error('Update failed:', error);
                // Optionally revert value or show error
            }
        } else {
            // New point
            if (xVal !== '' && yVal !== '') {
                try {
                    const result = await addPoint(activeDataset, xVal, yVal);
                    // Update the row with the new ID so it becomes an "existing" point
                    tr.dataset.id = result.id;
                    // Reload to update chart and list
                    loadActiveDatasetData();
                } catch (error) {
                    console.error('Add failed:', error);
                }
            }
        }
    }

    async function handleMetadataChange() {
        if (!activeDataset) return;
        const date = elements.datasetDateInput.value;
        const serialId = elements.datasetSerialIdInput.value;
        try {
            await updateDataset(activeDataset, { date: date, serial_id: serialId });
        } catch (error) {
            console.error('Failed to update metadata:', error);
            alert('Failed to save metadata.');
        }
    }

    function renderActiveChart(points) {
        const chartData = {
            datasets: [{
                label: activeDataset,
                data: points,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
            }]
        };
        if (activeChart) {
            destroyChart(activeChart);
        }
        activeChart = initializeOrUpdateChart(elements.activeChartCanvas, chartData.datasets);
    }

    async function renderComparisonChart(datasetNames) {
        try {
            // Note: getSelectedDatasetsForChart calls getDatasetPoints internally.
            // Since getDatasetPoints now returns {points: [...], date: ...},
            // we need to check if getSelectedDatasetsForChart needs updating.
            // Checking api.js... it uses getDatasetPoints(name) and expects an array.
            // We need to update api.js or handle it here?
            // Better to update api.js to handle the new return type.

            const chartData = await getSelectedDatasetsForChart(datasetNames);
            if (comparisonChart) {
                destroyChart(comparisonChart);
            }
            comparisonChart = initializeOrUpdateChart(elements.comparisonChartCanvas, chartData.datasets);
        } catch (error) {
            console.error('Error rendering comparison chart:', error);
        }
    }


    // --- Event Handlers ---
    async function handleCreateDataset() {
        const name = elements.newDatasetNameInput.value.trim();
        if (!name) return alert('Please enter a dataset name.');
        try {
            await createDataset(name);
            elements.newDatasetNameInput.value = '';
            loadAndRenderDatasets();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDeletePoint(pointId) {
        if (!activeDataset) return;
        if (confirm('Are you sure you want to delete this point?')) {
            try {
                await deletePoint(activeDataset, pointId);
                loadActiveDatasetData();
            } catch (error) {
                alert(error.message);
            }
        }
    }

    function handleDrawSelected() {
        const selectedDatasets = Array.from(elements.datasetSelector.selectedOptions).map(option => option.value);
        if (selectedDatasets.length === 0) {
            return alert('Please select at least one dataset to draw.');
        }
        renderComparisonChart(selectedDatasets);
    }

    function handleCollapse(columnId) {
        document.getElementById(columnId).classList.toggle('collapsed');
        setTimeout(() => {
            if (activeChart) {
                activeChart.resize();
            }
            if (comparisonChart) {
                comparisonChart.resize();
            }
        }, 300);
    }

    async function handleRegression(type) {
        if (!activeDataset || !activeChart) return;

        try {
            const regressionData = await getRegressionData(activeDataset, type);
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

            // Remove previous regression line of the same type
            const otherDatasets = activeChart.data.datasets.filter(d => d.label !== label && !d.label.startsWith(type === 'linear' ? 'Linear:' : 'Power:'));
            activeChart.data.datasets = [...otherDatasets, newDataset];
            activeChart.update();

        } catch (error) {
            console.error(`Error calculating ${type} regression:`, error);
            alert(error.message);
        }
    }

    function clearRegressions() {
        if (!activeChart) return;
        const originalDataset = activeChart.data.datasets.filter(d => !d.label.startsWith('Linear:') && !d.label.startsWith('Power:'));
        activeChart.data.datasets = originalDataset;
        activeChart.update();
    }


    // --- Event Listeners ---
    elements.datasetSearchInput.addEventListener('input', handleDatasetSearch);
    elements.comparisonSearchInput.addEventListener('input', handleComparisonSearch);
    elements.createDatasetBtn.addEventListener('click', handleCreateDataset);
    elements.drawSelectedBtn.addEventListener('click', handleDrawSelected);
    elements.collapseLeftBtn.addEventListener('click', () => handleCollapse('left-column'));
    elements.dragHandle.addEventListener('mousedown', startDrag);
    elements.regressionBtn.addEventListener('click', () => handleRegression('linear'));
    elements.powerRegressionBtn.addEventListener('click', () => handleRegression('power'));
    elements.clearRegressionBtn.addEventListener('click', clearRegressions);

    // Table Events
    elements.addRowBtn.addEventListener('click', handleTableAddRow);
    // Use 'change' event which fires on blur/enter. 'input' would be too aggressive.
    elements.pointsTableBody.addEventListener('change', handleTableInput);

    // Metadata Input Events
    elements.datasetDateInput.addEventListener('change', handleMetadataChange);
    elements.datasetSerialIdInput.addEventListener('change', handleMetadataChange);

    // Floating Window Events
    elements.openAnalysisBtn.addEventListener('click', () => analysisWindow.show());

    // --- Initial Load ---
    loadAndRenderDatasets();
});
