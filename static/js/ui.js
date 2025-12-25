// static/js/ui.js
import { getDatasets, getDatasetPoints } from './api.js';
import { initializeOrUpdateChart, destroyChart, destroyTotalChart } from './chart.js';

export function showDashboard(elements) {
    elements.editView.style.display = 'none';
    elements.dashboardView.style.display = 'block';
    destroyChart();
    destroyTotalChart();
    loadAndRenderDatasets(elements);
    populateDatasetSelector(elements);
}

async function populateDatasetSelector(elements) {
    try {
        const datasets = await getDatasets();
        console.log(datasets)
        elements.datasetSelector.innerHTML = '';
        datasets.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            elements.datasetSelector.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading datasets for selector:', error);
    }
}

export async function showEditView(elements, datasetName) {
    elements.dashboardView.style.display = 'none';
    elements.editView.style.display = 'block';
    elements.currentDatasetNameH1.textContent = datasetName;
    destroyTotalChart();
    destroyChart();

    try {
        const points = await getDatasetPoints(datasetName);
        const datasets = [{
            label: datasetName,
            data: points,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)'
        }];
        initializeOrUpdateChart(elements.ctx, datasets);
        renderPointsList(elements, points, datasetName);
    } catch (error) {
        console.error('Error loading points for edit view:', error);
        alert(error.message);
    }
}

async function loadAndRenderDatasets(elements) {
    try {
        const datasets = await getDatasets();
        renderDatasetList(elements, datasets);
    } catch (error) {
        console.error('Error loading datasets:', error);
        elements.datasetList.innerHTML = '<li>Error loading datasets.</li>';
    }
}

function renderDatasetList(elements, datasets) {
    elements.datasetList.innerHTML = '';
    datasets.forEach(name => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        li.appendChild(nameSpan);
        const controlsDiv = document.createElement('div');
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View/Edit';
        viewBtn.onclick = () => {
            elements.setCurrentDataset(name);
            showEditView(elements, name);
        };
        controlsDiv.appendChild(viewBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = async () => {
            if (confirm(`Are you sure you want to delete the dataset "${name}"?`)) {
                try {
                    await elements.deleteDatasetHandler(name);
                    loadAndRenderDatasets(elements);
                } catch (error) {
                    alert(error.message);
                }
            }
        };
        controlsDiv.appendChild(deleteBtn);
        li.appendChild(controlsDiv);
        elements.datasetList.appendChild(li);
    });
}

function renderPointsList(elements, points, datasetName) {
    elements.pointsList.innerHTML = '';
    points.forEach(point => {
        const li = document.createElement('li');
        const textSpan = document.createElement('span');
        textSpan.textContent = `(x: ${point.x}, y: ${point.y})`;
        li.appendChild(textSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = async () => {
            if (confirm(`Are you sure you want to delete this point?`)) {
                try {
                    await elements.deletePointHandler(datasetName, point.id);
                    // Refresh view
                    showEditView(elements, datasetName);
                } catch (error) {
                    alert(error.message);
                }
            }
        };
        li.appendChild(deleteBtn);

        elements.pointsList.appendChild(li);
    });
}
