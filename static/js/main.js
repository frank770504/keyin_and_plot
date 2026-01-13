// static/js/main.js
import * as api from './api.js';
import * as chartService from './chart_service.js';
import state, * as stateManager from './state.js';
import * as layout from './ui/layout.js';
import * as datasetUI from './ui/dataset_ui.js';
import * as workspaceUI from './ui/workspace_ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        // Left Column
        datasetListBody: document.getElementById('dataset-list-body'),
        datasetSearchInput: document.getElementById('dataset-search'),
        datasetListHeaders: document.querySelectorAll('#dataset-list-table th[data-sort]'),
        newDatasetNameInput: document.getElementById('new-dataset-name'),
        createDatasetBtn: document.getElementById('create-dataset-btn'),

        // Center Column
        centerColumn: document.getElementById('center-column'),
        activeDatasetName: document.getElementById('active-dataset-name'),
        activeDatasetNameInput: document.getElementById('active-dataset-name-input'),
        editToggleBtn: document.getElementById('edit-toggle-btn'),
        deleteDatasetBtn: document.getElementById('delete-dataset-btn'),
        datasetDateInput: document.getElementById('dataset-date'),
        datasetSerialIdInput: document.getElementById('dataset-serial-id'),
        pointsTableBody: document.querySelector('#points-table tbody'),
        openAnalysisBtn: document.getElementById('open-analysis-btn'),

        // Floating Window
        floatingWindow: document.getElementById('floating-chart-window'),
        windowHeader: document.getElementById('chart-window-header'),
        closeWindowBtn: document.getElementById('close-chart-window'),
        activeChartCanvas: document.getElementById('active-chart').getContext('2d'),
        regressionBtn: document.getElementById('regression-btn'),
        powerRegressionBtn: document.getElementById('power-regression-btn'),
        clearRegressionBtn: document.getElementById('clear-regression-btn'),

        // Right Column
        comparisonSearchInput: document.getElementById('comparison-search'),
        datasetSelector: document.getElementById('dataset-selector'),
        drawSelectedBtn: document.getElementById('draw-selected-btn'),
        comparisonChartCanvas: document.getElementById('comparison-chart').getContext('2d'),

        // Layout
        collapseLeftBtn: document.getElementById('collapse-left'),
        dragHandle: document.getElementById('drag-handle'),
    };

    let activeChart = null;
    let comparisonChart = null;

    // --- Layout Initialization ---
    layout.initLayoutCorrected(elements, [() => {
        if (activeChart) activeChart.resize();
        if (comparisonChart) comparisonChart.resize();
    }]);

    const analysisWindow = new layout.FloatingWindow(
        'floating-chart-window',
        'chart-window-header',
        'close-chart-window',
        () => {
            if (activeChart) activeChart.resize();
        }
    );

    // --- Controller Functions ---

    // 1. Data Loading & List Management
    async function loadAndRenderDatasets() {
        try {
            const datasets = await api.getDatasets();
            stateManager.setAllDatasets(datasets);
            refreshDatasetList();
            datasetUI.populateDatasetSelector(elements, datasets); // Populate with all initially
        } catch (error) {
            console.error('Error loading datasets:', error);
        }
    }

    function refreshDatasetList() {
        datasetUI.renderDatasetList(elements, setActiveDataset);
        datasetUI.updateSortIcons(elements);
    }

    // 2. Workspace & Active Dataset
    async function setActiveDataset(name) {
        if (state.activeDataset === name) {
            // Deselect
            stateManager.setActiveDataset(null);
            workspaceUI.toggleCenterColumn(elements, false);
            elements.activeDatasetName.textContent = 'No Dataset Selected';
        } else {
            // Select
            stateManager.setActiveDataset(name);
            stateManager.setEditing(false); // Reset edit mode
            workspaceUI.toggleCenterColumn(elements, true, () => {
                 if (activeChart) activeChart.resize();
            });
            workspaceUI.updateEditModeUI(elements);
            elements.activeDatasetName.textContent = name;
            await loadActiveDatasetData();
        }
        refreshDatasetList();
    }

    async function loadActiveDatasetData() {
        if (!state.activeDataset) return;

        try {
            const data = await api.getDatasetPoints(state.activeDataset);
            const points = data.points;

            elements.datasetDateInput.value = data.date || '';
            elements.datasetSerialIdInput.value = data.serial_id || '';

            workspaceUI.renderPointsTable(elements, points, handleDeletePoint);
            renderActiveChart(points);
        } catch (error) {
            console.error(`Error loading data for ${state.activeDataset}:`, error);
        }
    }

    function renderActiveChart(points) {
        const chartData = {
            datasets: [{
                label: state.activeDataset,
                data: points,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
            }]
        };
        if (activeChart) chartService.destroyChart(activeChart);
        activeChart = chartService.initializeOrUpdateChart(elements.activeChartCanvas, chartData.datasets);
    }

    // 3. User Actions
    function handleSort(e) {
        const column = e.currentTarget.dataset.sort;
        let { direction } = state.sortState;

        if (state.sortState.column === column) {
            direction = direction === 'asc' ? 'desc' : 'asc';
        } else {
            direction = 'asc';
        }
        stateManager.setSortState(column, direction);
        refreshDatasetList();
    }

    function handleDatasetSearch() {
        stateManager.setDatasetFilter(elements.datasetSearchInput.value);
        refreshDatasetList();
    }

    function handleComparisonSearch() {
        // Reuse getProcessedDatasets logic or simple filter?
        // Simple filter for now as per old logic
        const searchTerm = elements.comparisonSearchInput.value.toLowerCase();
        const filtered = state.allDatasets.filter(d => d.name.toLowerCase().includes(searchTerm));
        datasetUI.populateDatasetSelector(elements, filtered);
    }

    async function handleCreateDataset() {
        const name = elements.newDatasetNameInput.value.trim();
        if (!name) return alert('Please enter a dataset name.');
        try {
            await api.createDataset(name);
            elements.newDatasetNameInput.value = '';
            loadAndRenderDatasets();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDeleteDataset(name) {
        // If name is passed (from list context? removed now), or use active
        const targetName = name || state.activeDataset;
        if (!targetName) return;

        if (confirm(`Are you sure you want to delete the dataset "${targetName}"?`)) {
            try {
                await api.deleteDataset(targetName);
                if (state.activeDataset === targetName) {
                    stateManager.setActiveDataset(null);
                    workspaceUI.toggleCenterColumn(elements, false);
                    elements.activeDatasetName.textContent = 'No Dataset Selected';
                    if (activeChart) {
                        chartService.destroyChart(activeChart);
                        activeChart = null;
                    }
                }
                loadAndRenderDatasets();
            } catch (error) {
                alert(error.message);
            }
        }
    }

    function toggleEditMode() {
        stateManager.setEditing(!state.isEditing);
        workspaceUI.updateEditModeUI(elements);
        if (state.isEditing) {
            workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
        } else {
            loadActiveDatasetData(); // Reload to clear unsaved rows
        }
    }

    async function handleDatasetRename() {
        if (!state.activeDataset || !state.isEditing) return;
        const newName = elements.activeDatasetNameInput.value.trim();
        if (newName === state.activeDataset) return;
        if (!newName) {
            alert("Dataset name cannot be empty.");
            elements.activeDatasetNameInput.value = state.activeDataset;
            return;
        }

        try {
            await api.updateDataset(state.activeDataset, { name: newName });
            stateManager.setActiveDataset(newName);
            elements.activeDatasetName.textContent = newName;
            loadAndRenderDatasets(); // Refresh list
        } catch (error) {
            console.error('Failed to rename:', error);
            alert(error.message);
            elements.activeDatasetNameInput.value = state.activeDataset;
        }
    }

    async function handleMetadataChange() {
        if (!state.activeDataset) return;
        const date = elements.datasetDateInput.value;
        const serialId = elements.datasetSerialIdInput.value;
        try {
            await api.updateDataset(state.activeDataset, { date: date, serial_id: serialId });
        } catch (error) {
            console.error('Failed to update metadata:', error);
            alert('Failed to save metadata.');
        }
    }

    // Points Logic
    async function handleDeletePoint(pointId) {
        if (!state.activeDataset) return;
        if (confirm('Are you sure you want to delete this point?')) {
            try {
                await api.deletePoint(state.activeDataset, pointId);
                loadActiveDatasetData();
            } catch (error) {
                alert(error.message);
            }
        }
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

        if (xVal === '' && yVal === '') return;

        let chartNeedsUpdate = false;

        if (id) {
            if (input.value === '') return;
            try {
                await api.updatePoint(state.activeDataset, id, xVal, yVal);
                chartNeedsUpdate = true;
            } catch (error) { console.error(error); }
        } else {
            if (xVal !== '' && yVal !== '') {
                try {
                    const result = await api.addPoint(state.activeDataset, xVal, yVal);
                    tr.dataset.id = result.id;
                    workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
                    chartNeedsUpdate = true;
                } catch (error) { console.error(error); }
            }
        }

        if (chartNeedsUpdate) {
            try {
                const data = await api.getDatasetPoints(state.activeDataset);
                renderActiveChart(data.points);
            } catch (error) { console.error(error); }
        }
    }

    // Chart & Regression
    async function handleRegression(type) {
        if (!state.activeDataset || !activeChart) return;
        try {
            const regressionData = await api.getRegressionData(state.activeDataset, type);
            // Logic to add regression dataset to chart...
            // This logic is a bit tied to specific chart instance manipulation
            // Ideally should be in chart_service, but passing the chart instance or managing it there is cleaner.
            // For now, I'll inline the logic but adapt it.

            const regressionPoints = regressionData.regression_points;
            let label;
            if (type === 'linear') {
                const { r_squared, slope, intercept } = regressionData;
                label = `Linear: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}, R² = ${r_squared.toFixed(2)}`;
            } else {
                const { r_squared, a, b } = regressionData;
                label = `Power: y = ${a.toFixed(2)}x^${b.toFixed(2)}, R² = ${r_squared.toFixed(2)}`;
            }

            const newDataset = {
                label: label,
                data: regressionPoints,
                borderColor: type === 'linear' ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(0,0,0,0)',
                type: 'line',
                showLine: true,
                fill: false
            };

            const otherDatasets = activeChart.data.datasets.filter(d =>
                d.label !== label && !d.label.startsWith(type === 'linear' ? 'Linear:' : 'Power:')
            );
            activeChart.data.datasets = [...otherDatasets, newDataset];
            activeChart.update();

        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    function clearRegressions() {
        if (!activeChart) return;
        const originalDataset = activeChart.data.datasets.filter(d =>
            !d.label.startsWith('Linear:') && !d.label.startsWith('Power:')
        );
        activeChart.data.datasets = originalDataset;
        activeChart.update();
    }

    async function handleDrawSelected() {
        const selectedNames = Array.from(elements.datasetSelector.selectedOptions).map(o => o.value);
        if (selectedNames.length === 0) return alert('Select datasets.');

        try {
            const chartData = await chartService.getSelectedDatasetsForChart(selectedNames);
            if (comparisonChart) chartService.destroyChart(comparisonChart);
            comparisonChart = chartService.initializeOrUpdateChart(elements.comparisonChartCanvas, chartData.datasets);
        } catch (error) {
            console.error(error);
        }
    }


    // --- Event Listeners ---
    elements.datasetSearchInput.addEventListener('input', handleDatasetSearch);
    elements.datasetListHeaders.forEach(th => th.addEventListener('click', handleSort));
    elements.comparisonSearchInput.addEventListener('input', handleComparisonSearch);
    elements.createDatasetBtn.addEventListener('click', handleCreateDataset);

    elements.editToggleBtn.addEventListener('click', toggleEditMode);
    elements.deleteDatasetBtn.addEventListener('click', () => handleDeleteDataset(state.activeDataset));
    elements.activeDatasetNameInput.addEventListener('change', handleDatasetRename);

    elements.datasetDateInput.addEventListener('change', handleMetadataChange);
    elements.datasetSerialIdInput.addEventListener('change', handleMetadataChange);

    elements.pointsTableBody.addEventListener('change', handleTableInput);

    elements.openAnalysisBtn.addEventListener('click', () => analysisWindow.show());
    elements.regressionBtn.addEventListener('click', () => handleRegression('linear'));
    elements.powerRegressionBtn.addEventListener('click', () => handleRegression('power'));
    elements.clearRegressionBtn.addEventListener('click', clearRegressions);

    elements.drawSelectedBtn.addEventListener('click', handleDrawSelected);


    // --- Initial Load ---
    loadAndRenderDatasets();
});
