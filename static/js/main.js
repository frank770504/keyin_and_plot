import { getDatasets, createDataset, deleteDataset, getDatasetPoints, addPoint, deletePoint, getRegressionData, getSelectedDatasetsForChart } from './api.js';
import { initializeOrUpdateChart, destroyChart } from './chart.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let activeDataset = null;
    let activeChart = null;
    let comparisonChart = null;

    // --- DOM Elements ---
    const elements = {
        // Left Column
        datasetList: document.getElementById('dataset-list'),
        newDatasetNameInput: document.getElementById('new-dataset-name'),
        createDatasetBtn: document.getElementById('create-dataset-btn'),

        // Center Column
        activeDatasetName: document.getElementById('active-dataset-name'),
        tabs: document.querySelectorAll('.tab-link'),
        dataTab: document.getElementById('data-tab'),
        analysisTab: document.getElementById('analysis-tab'),
        xInput: document.getElementById('x-input'),
        yInput: document.getElementById('y-input'),
        addPointBtn: document.getElementById('add-point-btn'),
        pointsList: document.getElementById('points-list'),
        activeChartCanvas: document.getElementById('active-chart').getContext('2d'),
        regressionBtn: document.getElementById('regression-btn'),
        powerRegressionBtn: document.getElementById('power-regression-btn'),
        clearRegressionBtn: document.getElementById('clear-regression-btn'),


        // Right Column
        datasetSelector: document.getElementById('dataset-selector'),
        drawSelectedBtn: document.getElementById('draw-selected-btn'),
        comparisonChartCanvas: document.getElementById('comparison-chart').getContext('2d'),

        // Collapse Buttons
        collapseLeftBtn: document.getElementById('collapse-left'),
        collapseCenterBtn: document.getElementById('collapse-center'),
    };

    // --- Functions ---

    // --- Data Loading and Rendering ---
    async function loadAndRenderDatasets() {
        try {
            const datasets = await getDatasets();
            renderDatasetList(datasets);
            populateDatasetSelector(datasets);
        } catch (error) {
            console.error('Error loading datasets:', error);
        }
    }

    function renderDatasetList(datasets) {
        elements.datasetList.innerHTML = '';
        datasets.forEach(name => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.addEventListener('click', () => setActiveDataset(name));
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
                    elements.activeDatasetName.textContent = 'No Dataset Selected';
                    elements.pointsList.innerHTML = '';
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
        activeDataset = name;
        elements.activeDatasetName.textContent = name;
        renderDatasetList(await getDatasets());
        loadActiveDatasetData();
    }

    async function loadActiveDatasetData() {
        if (!activeDataset) return;

        try {
            const points = await getDatasetPoints(activeDataset);
            renderPointsList(points);
            renderActiveChart(points);
        } catch (error) {
            console.error(`Error loading data for ${activeDataset}:`, error);
        }
    }

    function renderPointsList(points) {
        elements.pointsList.innerHTML = '';
        points.forEach(point => {
            const li = document.createElement('li');
            li.textContent = `(x: ${point.x}, y: ${point.y})`;
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => handleDeletePoint(point.id));
            li.appendChild(deleteBtn);
            elements.pointsList.appendChild(li);
        });
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

    async function handleAddPoint() {
        if (!activeDataset) return alert('Please select a dataset first.');
        const x = elements.xInput.value;
        const y = elements.yInput.value;
        if (x === '' || y === '') {
            return alert('Please enter both X and Y values.');
        }
        try {
            await addPoint(activeDataset, x, y);
            elements.xInput.value = '';
            elements.yInput.value = '';
            loadActiveDatasetData();
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

    function handleTabClick(event) {
        elements.tabs.forEach(tab => tab.classList.remove('active'));
        event.target.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(event.target.dataset.tab).classList.add('active');
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
        console.log("collapsed button")
        setTimeout(() => {
            if (activeChart) {
                activeChart.resize();
            }
            if (comparisonChart) {
                comparisonChart.resize();
            }
        }, 300);
    }


    // --- Event Listeners ---
    elements.createDatasetBtn.addEventListener('click', handleCreateDataset);
    elements.addPointBtn.addEventListener('click', handleAddPoint);
    elements.tabs.forEach(tab => tab.addEventListener('click', handleTabClick));
    elements.drawSelectedBtn.addEventListener('click', handleDrawSelected);
    elements.collapseLeftBtn.addEventListener('click', () => handleCollapse('left-column'));
    elements.collapseCenterBtn.addEventListener('click', () => handleCollapse('center-column'));


    // --- Initial Load ---
    loadAndRenderDatasets();
});
