// static/js/main.js
import * as api from './api.js';
import * as chartService from './chart_service.js';
import state, * as stateManager from './state.js';
import * as layout from './ui/layout.js';
import * as datasetUI from './ui/dataset_ui.js';
import * as workspaceUI from './ui/workspace_ui.js';
import { createFloatingLegend, makeDraggable } from './ui/legend_ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        // Left Column
        datasetListBody: document.getElementById('dataset-list-body'),
        datasetSearchInput: document.getElementById('dataset-search'),
        datasetListHeaders: document.querySelectorAll('#dataset-list-table th[data-sort]'),
        newDatasetNameInput: document.getElementById('new-dataset-name'),
        createDatasetBtn: document.getElementById('create-dataset-btn'),

        // Lock & User UI
        lockStatusText: document.getElementById('lock-status-text'),
        usernameInput: document.getElementById('username-input'),

        // Center Column
        centerColumn: document.getElementById('center-column'),
        activeDatasetName: document.getElementById('active-dataset-name'),
        activeDatasetNameInput: document.getElementById('active-dataset-name-input'),
        editBtn: document.getElementById('edit-btn'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        deleteDatasetBtn: document.getElementById('delete-dataset-btn'),
        datasetDateInput: document.getElementById('dataset-date'),
        datasetSerialIdInput: document.getElementById('dataset-serial-id'),
        datasetSpindleSelect: document.getElementById('dataset-spindle'),
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
        drawSelectedBtn: document.getElementById('draw-selected-btn'),
        comparisonChartCanvas: document.getElementById('comparison-chart').getContext('2d'),
        customLegend: document.getElementById('custom-legend'),

        // Layout
        collapseLeftBtn: document.getElementById('collapse-left'),
        dragHandle: document.getElementById('drag-handle'),

        // Dialogs
        unsavedChangesDialog: document.getElementById('unsaved-changes-dialog'),
    };

    let activeChart = null;
    let comparisonChart = null;
    const activeRequests = new Map(); // Track latest request ID per row
    const pendingAdds = new Set();    // Track rows currently being created in DB

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

    // Initialize Draggable Legend
    makeDraggable(elements.customLegend);

    // 0. Lock & User Management
    function initUserConfig() {
        if (!state.userName) {
            stateManager.setUserName('User-' + Math.random().toString(36).substring(2, 6));
        }
        elements.usernameInput.value = state.userName;

        elements.usernameInput.addEventListener('change', () => {
            const newName = elements.usernameInput.value.trim();
            if (newName) {
                stateManager.setUserName(newName);
            } else {
                elements.usernameInput.value = state.userName;
            }
        });
    }

    async function pollLockStatus() {
        try {
            const data = await api.getLockStatus();
            if (data.locked) {
                if (data.is_me && !state.heartbeatInterval) {
                    stateManager.setGlobalEditor(true, data.user_name);
                    startHeartbeat();
                }
                updateLockUI(data.locked, data.user_name, data.is_me);
            } else {
                updateLockUI(false);
            }
        } catch (error) {
            console.error('Lock poll failed:', error);
        }
    }

    function updateLockUI(locked, owner = null, isMe = false) {
        if (locked) {
            if (isMe) {
                elements.lockStatusText.textContent = 'Status: You are the Editor';
                elements.lockStatusText.style.color = '#28a745';
            } else {
                elements.lockStatusText.textContent = `Status: ${owner} is Editing`;
                elements.lockStatusText.style.color = '#dc3545';
            }
        } else {
            elements.lockStatusText.textContent = 'Status: Ready';
            elements.lockStatusText.style.color = '#666';

            if (state.isGlobalEditor) {
                stopEditingDueToLockLoss();
            }
        }

        const canWrite = state.isGlobalEditor || !locked;
        elements.createDatasetBtn.disabled = !canWrite;
        elements.newDatasetNameInput.disabled = !canWrite;

        // If someone else took the lock while we were editing
        if (locked && !isMe && state.isEditing) {
            stopEditingDueToLockLoss();
            alert(`Your session was interrupted. ${owner} is now the editor.`);
        }
    }

    function startHeartbeat() {
        const intervalId = setInterval(async () => {
            try {
                await api.sendHeartbeat();
            } catch (error) {
                console.error('Heartbeat lost:', error);
                stopEditingDueToLockLoss();
                alert('Your editor session has expired or was taken over.');
            }
        }, 30000);
        stateManager.setHeartbeat(intervalId);
    }

    async function ensureLock() {
        if (state.isGlobalEditor) return true;
        try {
            await api.acquireLock(state.userName, state.sessionID);
            stateManager.setGlobalEditor(true, state.userName);
            startHeartbeat();
            updateLockUI(true, state.userName, true);
            return true;
        } catch (error) {
            alert(`Action failed: ${error.message}`);
            return false;
        }
    }

    async function releaseLockIfPossible() {
        if (!state.isGlobalEditor || state.isEditing) return;
        try {
            await api.releaseLock();
            stateManager.setGlobalEditor(false);
            stateManager.clearHeartbeat();
            updateLockUI(false);
        } catch (error) {
            console.error('Failed to release lock:', error);
        }
    }

    function stopEditingDueToLockLoss() {
        stateManager.setGlobalEditor(false);
        stateManager.clearHeartbeat();
        if (state.isEditing) {
            stateManager.setEditing(false);
            stateManager.setEditingOriginalName(null);
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);
            loadActiveDatasetData();
        }
    }

    // 1. Data Loading & List Management
    async function loadAndRenderDatasets() {
        try {
            const datasets = await api.getDatasets();
            stateManager.setAllDatasets(datasets);
            refreshDatasetList();
        } catch (error) {
            console.error('Error loading datasets:', error);
        }
    }

    function refreshDatasetList() {
        datasetUI.renderDatasetList(elements, setActiveDataset);
        datasetUI.updateSortIcons(elements);
    }

    function showUnsavedChangesDialog() {
        const dialog = elements.unsavedChangesDialog;
        return new Promise((resolve) => {
            const handleClose = () => {
                dialog.removeEventListener('close', handleClose);
                resolve(dialog.returnValue); // "save", "discard", or "stay"
            };
            dialog.addEventListener('close', handleClose);
            dialog.showModal();
        });
    }

    // 2. Workspace & Active Dataset
    async function setActiveDataset(name) {
        // --- Handle Unsaved Changes ---
        if (state.isEditing && state.activeDataset) {
            // If clicking a different dataset OR clicking the same one to deselect
            const action = await showUnsavedChangesDialog();

            if (action === 'save') {
                await commitEditMode();
            } else if (action === 'discard') {
                await cancelEditMode();
            } else {
                // "stay" or dialog closed without action
                refreshDatasetList();
                return;
            }
        }

        if (state.activeDataset === name) {
            // Deselect
            stateManager.setActiveDataset(null);
            workspaceUI.toggleCenterColumn(elements, false);
            elements.activeDatasetName.textContent = 'No Dataset Selected';
            elements.editBtn.style.display = 'none';
            elements.cancelEditBtn.style.display = 'none';
        } else {
            // Select
            stateManager.setActiveDataset(name);
            stateManager.setEditing(false); // Reset edit mode
            elements.editBtn.style.display = 'inline-block';
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
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
            elements.datasetSpindleSelect.value = data.spindle_id || '';

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
                data: points.map(p => ({ x: p.shear_rate, y: p.shear_stress })),
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

    async function handleCreateDataset() {
        const name = elements.newDatasetNameInput.value.trim();
        if (!name) return alert('Please enter a dataset name.');

        const lockAcquired = await ensureLock();
        if (!lockAcquired) return;

        try {
            await api.createDataset(name);
            elements.newDatasetNameInput.value = '';
            loadAndRenderDatasets();
        } catch (error) {
            alert(error.message);
        } finally {
            await releaseLockIfPossible();
        }
    }

    async function handleDeleteDataset(name) {
        const targetName = name || state.activeDataset;
        if (!targetName) return;

        if (confirm(`Are you sure you want to delete the dataset "${targetName}"?`)) {
            const lockAcquired = await ensureLock();
            if (!lockAcquired) return;

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
            } finally {
                await releaseLockIfPossible();
            }
        }
    }

    async function startEditMode() {
        if (!state.activeDataset) return;

        const lockAcquired = await ensureLock();
        if (!lockAcquired) return;

        try {
            await api.startEdit(state.activeDataset);

            stateManager.setEditingOriginalName(state.activeDataset); // Store for potential rollback
            stateManager.setEditing(true);
            elements.editBtn.textContent = 'Save';
            elements.cancelEditBtn.style.display = 'inline-block';
            workspaceUI.updateEditModeUI(elements);

            // Reload to get the new DRAFT IDs for points
            await loadActiveDatasetData();

            workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
        } catch (error) {
            alert(error.message);
        }
    }

    async function commitEditMode() {
        try {
            await api.commitEdit(state.activeDataset);
            stateManager.setEditing(false);
            stateManager.setEditingOriginalName(null);
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);
            await loadActiveDatasetData();
            loadAndRenderDatasets(); // Refresh list to reflect potential name change

            await releaseLockIfPossible();
        } catch (error) {
            alert(error.message);
        }
    }

    async function cancelEditMode() {
        try {
            // Use the current active dataset name to hit the rollback API
            await api.rollbackEdit(state.activeDataset);

            // If the name was changed during draft, we must revert to the original name
            if (state.activeDataset !== state.editingOriginalName) {
                stateManager.setActiveDataset(state.editingOriginalName);
                elements.activeDatasetName.textContent = state.editingOriginalName;
            }

            stateManager.setEditing(false);
            stateManager.setEditingOriginalName(null);
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);
            await loadActiveDatasetData(); // Reload original data

            await releaseLockIfPossible();
        } catch (error) {
            alert(error.message);
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
            await api.updateMetadata(state.activeDataset, { name: newName });
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
        if (!state.activeDataset || !state.isEditing) return;
        const date = elements.datasetDateInput.value;
        const serialId = elements.datasetSerialIdInput.value;
        const spindleId = elements.datasetSpindleSelect.value;
        try {
            await api.updateMetadata(state.activeDataset, {
                date: date,
                serial_id: serialId,
                spindle_id: spindleId
            });
            // Reload all data after metadata change, especially for spindle-based recalculations
            await loadActiveDatasetData();
        } catch (error) {
            console.error('Failed to update metadata:', error);
            alert('Failed to save metadata.');
        }
    }

    // Points Logic
    async function handleDeletePoint(pointId) {
        if (!state.activeDataset || !state.isEditing) return;
        if (confirm('Are you sure you want to delete this point?')) {
            try {
                await api.deletePoint(state.activeDataset, pointId);
                await loadActiveDatasetData();
                workspaceUI.ensureEmptyRow(elements, handleDeletePoint); // Ensure we still have an empty row
            } catch (error) {
                alert(error.message);
            }
        }
    }

    async function syncTableRow(tr) {
        if (!state.isEditing) return;

        // --- Check for Spindle ---
        const spindleId = elements.datasetSpindleSelect.value;
        if (!spindleId) {
            alert('Please select a Spindle ID before adding data points.');
            return;
        }

        let id = tr.dataset.id;
        const requestId = Date.now();
        activeRequests.set(tr, requestId);

        // Inputs
        const nInput = tr.querySelector('input[data-field="N"]');
        const etaInput = tr.querySelector('input[data-field="eta"]');
        const torqueInput = tr.querySelector('input[data-field="torque"]');

        // Calculated Displays (Spans)
        const shearRateDisplay = tr.querySelector('[data-field="shear_rate"]');
        const shearStressDisplay = tr.querySelector('[data-field="shear_stress"]');

        const nVal = nInput.value;
        const etaVal = etaInput.value;
        const torqueVal = torqueInput.value;

        // Only proceed if ALL three fields (N, eta, torque) have values
        if (nVal === '' || etaVal === '' || torqueVal === '') return;

        // --- Start Saving State ---
        tr.classList.add('syncing');
        shearRateDisplay.classList.add('syncing');
        shearStressDisplay.classList.add('syncing');

        let chartNeedsUpdate = false;
        let result = null;

        try {
            if (id) {
                // Update existing point
                result = await api.updatePoint(state.activeDataset, id, nVal, etaVal, torqueVal);
                chartNeedsUpdate = true;
            } else {
                // Create new point - LOCK to prevent duplicates if user is still typing
                if (pendingAdds.has(tr)) return;
                pendingAdds.add(tr);
                try {
                    result = await api.addPoint(state.activeDataset, nVal, etaVal, torqueVal);
                    tr.dataset.id = result.id;
                    id = result.id; // Update local var for success check
                    workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
                    chartNeedsUpdate = true;
                } finally {
                    pendingAdds.delete(tr);
                }
            }

            // --- Success Check ---
            // Only update UI if this is the most recent request for this row
            if (activeRequests.get(tr) === requestId) {
                if (result && result.shear_rate !== undefined && result.shear_stress !== undefined) {
                     shearRateDisplay.textContent = parseFloat(result.shear_rate).toFixed(3);
                     shearStressDisplay.textContent = parseFloat(result.shear_stress).toFixed(3);
                }
                tr.classList.remove('syncing');
                tr.classList.remove('error');
            }

        } catch (error) {
            console.error('Save failed:', error);
            if (activeRequests.get(tr) === requestId) {
                tr.classList.remove('syncing');
                tr.classList.add('error');
            }
        } finally {
             if (activeRequests.get(tr) === requestId) {
                 shearRateDisplay.classList.remove('syncing');
                 shearStressDisplay.classList.remove('syncing');
             }
        }

        if (chartNeedsUpdate) {
            try {
                const data = await api.getDatasetPoints(state.activeDataset);
                renderActiveChart(data.points);
            } catch (error) { console.error('Chart reload failed:', error); }
        }
    }

    function handleTableNumericValidation(e) {
        if (e.target.tagName !== 'INPUT') return;
        const input = e.target;
        const rawVal = input.value;

        // Strict numeric filter
        const isValid = /^-?\d*\.?\d*$/.test(rawVal);
        if (!isValid) {
            input.value = state.lastValidValues.get(input) || '';
            return;
        }
        state.lastValidValues.set(input, rawVal);

        // Proactive row creation: if the current row is now complete, pop up the next one
        const tr = input.closest('tr');
        const nVal = tr.querySelector('input[data-field="N"]').value;
        const etaVal = tr.querySelector('input[data-field="eta"]').value;
        const torqueVal = tr.querySelector('input[data-field="torque"]').value;

        if (nVal !== '' && etaVal !== '' && torqueVal !== '') {
            workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
            syncTableRow(tr); // Immediately call backend when finished
        }
    }

    async function handleTableInput(e) {
        if (e.target.tagName !== 'INPUT') return;
        const tr = e.target.closest('tr');
        await syncTableRow(tr);
    }

    // Chart & Regression
    async function handleRegression(type) {
        if (!state.activeDataset || !activeChart) return;
        try {
            const regressionData = await api.getRegressionData(state.activeDataset, type);

            const regressionPoints = regressionData.regression_points.map(p => ({ x: p.shear_rate, y: p.shear_stress }));
            let label;
            if (type === 'linear') {
                const { r_squared, slope, intercept } = regressionData;
                label = `Linear: $\\sigma = ${slope.toFixed(3)}\\,\\dot{\\gamma} + ${intercept.toFixed(3)}, R^2 = ${r_squared.toFixed(3)}$`;
            } else {
                const { r_squared, a, b } = regressionData;
                label = `Power: $\\sigma = ${a.toFixed(3)}\\,\\dot{\\gamma}^{${b.toFixed(3)}}, R^2 = ${r_squared.toFixed(3)}$`;
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
        const selectedNames = Array.from(state.comparisonSelected);
        if (selectedNames.length === 0) return alert('Select datasets.');

        try {
            const chartData = await chartService.getSelectedDatasetsForChart(selectedNames);
            if (comparisonChart) chartService.destroyChart(comparisonChart);
            comparisonChart = chartService.initializeOrUpdateChart(elements.comparisonChartCanvas, chartData.datasets);

            // Generate Custom Legend
            createFloatingLegend(comparisonChart, elements.customLegend);
        } catch (error) {
            console.error(error);
        }
    }


    function handleTableKeydown(e) {
        if (e.target.tagName !== 'INPUT') return;

        const input = e.target;
        const tr = input.closest('tr');
        const field = input.dataset.field;
        const fields = ['N', 'eta', 'torque'];
        const fieldIndex = fields.indexOf(field);

        if (e.key === 'Enter') {
            e.preventDefault();
            syncTableRow(tr); // Explicitly trigger sync on Enter

            if (fieldIndex === fields.length - 1) {
                // Last field, move to next row's first field
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                    const firstInput = nextTr.querySelector('input[data-field="N"]');
                    if (firstInput) firstInput.focus();
                }
            } else {
                // Move to next field in same row
                const nextField = fields[fieldIndex + 1];
                const nextInput = tr.querySelector(`input[data-field="${nextField}"]`);
                if (nextInput) nextInput.focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); // Stop value change
            const prevTr = tr.previousElementSibling;
            if (prevTr) {
                const target = prevTr.querySelector(`input[data-field="${field}"]`);
                if (target) target.focus();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault(); // Stop value change
            const nextTr = tr.nextElementSibling;
            if (nextTr) {
                const target = nextTr.querySelector(`input[data-field="${field}"]`);
                if (target) target.focus();
            }
        } else if (e.key === 'ArrowLeft') {
            if (input.selectionStart === 0 && input.selectionEnd === 0) {
                e.preventDefault();
                if (fieldIndex > 0) {
                    const prevField = fields[fieldIndex - 1];
                    const target = tr.querySelector(`input[data-field="${prevField}"]`);
                    if (target) {
                        target.focus();
                        // Set cursor at the end of the previous cell
                        setTimeout(() => target.setSelectionRange(target.value.length, target.value.length), 0);
                    }
                } else {
                    // Wrap to previous row's last field
                    const prevTr = tr.previousElementSibling;
                    if (prevTr) {
                        const target = prevTr.querySelector('input[data-field="torque"]');
                        if (target) {
                            target.focus();
                            setTimeout(() => target.setSelectionRange(target.value.length, target.value.length), 0);
                        }
                    }
                }
            }
        } else if (e.key === 'ArrowRight') {
            if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
                e.preventDefault();
                if (fieldIndex < fields.length - 1) {
                    const nextField = fields[fieldIndex + 1];
                    const target = tr.querySelector(`input[data-field="${nextField}"]`);
                    if (target) {
                        target.focus();
                        // Set cursor at the beginning of the next cell
                        setTimeout(() => target.setSelectionRange(0, 0), 0);
                    }
                } else {
                    // Wrap to next row's first field
                    const nextTr = tr.nextElementSibling;
                    if (nextTr) {
                        const target = nextTr.querySelector('input[data-field="N"]');
                        if (target) {
                            target.focus();
                            setTimeout(() => target.setSelectionRange(0, 0), 0);
                        }
                    }
                }
            }
        }
    }

    // --- Event Listeners ---
    elements.pointsTableBody.addEventListener('keydown', handleTableKeydown);
    elements.datasetSearchInput.addEventListener('input', handleDatasetSearch);
    elements.datasetListHeaders.forEach(th => th.addEventListener('click', handleSort));
    elements.createDatasetBtn.addEventListener('click', handleCreateDataset);

    elements.editBtn.addEventListener('click', () => {
        if (!state.isEditing) {
            startEditMode();
        } else {
            commitEditMode();
        }
    });
    elements.cancelEditBtn.addEventListener('click', cancelEditMode);

    elements.deleteDatasetBtn.addEventListener('click', () => handleDeleteDataset(state.activeDataset));
    elements.activeDatasetNameInput.addEventListener('change', handleDatasetRename);

    elements.datasetDateInput.addEventListener('change', handleMetadataChange);
    elements.datasetSerialIdInput.addEventListener('change', handleMetadataChange);
    elements.datasetSpindleSelect.addEventListener('change', handleMetadataChange);

    elements.pointsTableBody.addEventListener('input', handleTableNumericValidation);
    elements.pointsTableBody.addEventListener('change', handleTableInput);

    elements.openAnalysisBtn.addEventListener('click', () => analysisWindow.show());
    elements.regressionBtn.addEventListener('click', () => handleRegression('linear'));
    elements.powerRegressionBtn.addEventListener('click', () => handleRegression('power'));
    elements.clearRegressionBtn.addEventListener('click', clearRegressions);

    elements.drawSelectedBtn.addEventListener('click', handleDrawSelected);


    // --- Initial Load & Polling ---
    initUserConfig();
    loadAndRenderDatasets();
    pollLockStatus();
    setInterval(pollLockStatus, 10000); // Poll lock status every 10s
});
