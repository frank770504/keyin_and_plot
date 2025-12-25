// static/js/main.js
import { showDashboard, showEditView } from './ui.js';
import { createDataset, addPoint, deleteDataset, deletePoint } from './api.js';
import { drawRegression, clearRegressions, drawSelectedDatasetsChart } from './chart.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentDataset = null;

    const setCurrentDataset = (name) => {
        currentDataset = name;
    };

    // --- DOM Elements ---
    // A single object to hold all element references
    const elements = {
        dashboardView: document.getElementById('dashboard-view'),
        editView: document.getElementById('edit-view'),
        datasetList: document.getElementById('dataset-list'),
        createDatasetBtn: document.getElementById('create-dataset-btn'),
        newDatasetNameInput: document.getElementById('new-dataset-name'),
        backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
        currentDatasetNameH1: document.getElementById('current-dataset-name'),
        pointsList: document.getElementById('points-list'),
        xInput: document.getElementById('x-input'),
        yInput: document.getElementById('y-input'),
        addPointBtn: document.getElementById('add-point-btn'),
        regressionBtn: document.getElementById('regression-btn'),
        powerRegressionBtn: document.getElementById('power-regression-btn'),
        clearRegressionBtn: document.getElementById('clear-regression-btn'),
        drawAllBtn: document.getElementById('draw-all-btn'),
        datasetSelector: document.getElementById('dataset-selector'),
        ctx: document.getElementById('myChart').getContext('2d'),
        ctx_all: document.getElementById('totalChart').getContext('2d'),
        setCurrentDataset,
        deleteDatasetHandler: deleteDataset,
        deletePointHandler: deletePoint,
    };

    // --- Event Handlers ---
    async function handleCreateDataset() {
        const name = elements.newDatasetNameInput.value.trim();
        if (!name) return alert('Please enter a dataset name.');
        try {
            await createDataset(name);
            elements.newDatasetNameInput.value = '';
            showDashboard(elements); // Refresh dashboard
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleAddPoint() {
        const x = elements.xInput.value;
        const y = elements.yInput.value;
        if (x === '' || y === '' || !currentDataset) {
            alert('Please enter both X and Y values.');
            return;
        }
        try {
            await addPoint(currentDataset, x, y);
            elements.xInput.value = '';
            elements.yInput.value = '';
            showEditView(elements, currentDataset); // Refresh edit view
        } catch (error) {
            alert(error.message);
        }
    }


    // --- Event Listeners ---
    elements.createDatasetBtn.addEventListener('click', handleCreateDataset);
    elements.addPointBtn.addEventListener('click', handleAddPoint);
    elements.backToDashboardBtn.addEventListener('click', () => showDashboard(elements));
    elements.drawAllBtn.addEventListener('click', () => {
        const selectedDatasets = Array.from(elements.datasetSelector.selectedOptions).map(option => option.value);
        console.log(selectedDatasets);
        if (selectedDatasets.length === 0) {
            alert('Please select at least one dataset to draw.');
            return;
        }
        drawSelectedDatasetsChart(elements.ctx_all, selectedDatasets);
    });
    elements.regressionBtn.addEventListener('click', () => drawRegression(currentDataset, 'linear'));
    elements.powerRegressionBtn.addEventListener('click', () => drawRegression(currentDataset, 'power'));
    elements.clearRegressionBtn.addEventListener('click', clearRegressions);

    // --- Initial Load ---
    showDashboard(elements);
});
