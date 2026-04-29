// static/js/main.js
import * as api from './api.js';
import * as chartService from './chart_service.js';
import state, * as stateManager from './state.js';
import * as layout from './ui/layout.js';
import * as measurementUI from './ui/measurement_ui.js';
import * as workspaceUI from './ui/workspace_ui.js';
import { createFloatingLegend, makeDraggable } from './ui/legend_ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        // Left Column
        measurementListBody: document.getElementById('measurement-list-body'),
        measurementSearchInput: document.getElementById('measurement-search'),
        measurementListHeaders: document.querySelectorAll('#measurement-list-table th[data-sort]'),
        addMeasurementBtn: document.getElementById('add-measurement-btn'),

        // Lock & User UI
        lockStatusText: document.getElementById('lock-status-text'),
        usernameInput: document.getElementById('username-input'),

        // Center Column
        centerColumn: document.getElementById('center-column'),
        activeMeasurementName: document.getElementById('active-measurement-name'),
        activeMeasurementNameInput: document.getElementById('active-measurement-name-input'),
        editBtn: document.getElementById('edit-btn'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        deleteMeasurementBtn: document.getElementById('delete-measurement-btn'),
        measurementDateInput: document.getElementById('measurement-date'),
        measurementSerialIdInput: document.getElementById('measurement-serial-id'),
        measurementSpindleSelect: document.getElementById('measurement-spindle'),
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
        leftColumn: document.getElementById('left-column'),
        collapseLeftBtn: document.getElementById('collapse-left'),
        collapseCenterBtn: document.getElementById('collapse-center'),
        gutterLeft: document.getElementById('gutter-left'),
        gutterCenter: document.getElementById('gutter-center'),

        // Dialogs
        unsavedChangesDialog: document.getElementById('unsaved-changes-dialog'),
    };

    let activeChart = null;
    let comparisonChart = null;
    const activeRequests = new Map(); // Track latest request ID per row
    const pendingAdds = new Set();    // Track rows currently being created in DB

    // --- Layout Initialization ---
    const layoutControl = layout.initLayout(elements, [() => {
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
                updateLockUI(data.locked, data.user_name, data.is_me);
            } else {
                updateLockUI(false);
            }
        } catch (error) {
            console.error('Lock poll failed:', error);
        }
    }

    // --- Page Lifecycle Logic ---
    window.addEventListener('beforeunload', (e) => {
        if (state.isEditing) {
            // Standard browser warning for unsaved changes
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.addEventListener('unload', () => {
        if (state.isGlobalEditor) {
            // Last-second request to release lock immediately on refresh/close
            const data = JSON.stringify({ session_id: state.sessionID });
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon('/api/lock/release', blob);
        }
    });

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
        elements.addMeasurementBtn.disabled = !canWrite;

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
            loadActiveMeasurementData();
        }
    }

    // 1. Data Loading & List Management
    async function loadAndRenderMeasurements() {
        try {
            const measurements = await api.getMeasurements();
            stateManager.setAllMeasurements(measurements);
            refreshMeasurementList();
        } catch (error) {
            console.error('Error loading measurements:', error);
        }
    }

    function refreshMeasurementList() {
        measurementUI.renderMeasurementList(elements, setActiveMeasurement);
        measurementUI.updateSortIcons(elements);
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

    // 2. Workspace & Active Measurement
    async function setActiveMeasurement(name) {
        // --- Handle Unsaved Changes ---
        if (state.isEditing && state.activeMeasurement) {
            // If clicking a different measurement OR clicking the same one to deselect
            const action = await showUnsavedChangesDialog();

            if (action === 'save') {
                await commitEditMode();
            } else if (action === 'discard') {
                await cancelEditMode();
            } else {
                // "stay" or dialog closed without action
                refreshMeasurementList();
                return;
            }
        }

        if (state.activeMeasurement === name) {
            // Deselect
            stateManager.setActiveMeasurement(null);
            workspaceUI.toggleCenterColumn(elements, false);
            elements.activeMeasurementName.textContent = 'No Measurement Selected';
            elements.editBtn.style.display = 'none';
            elements.cancelEditBtn.style.display = 'none';
        } else {
            // Select
            stateManager.setActiveMeasurement(name);
            stateManager.setEditing(false); // Reset edit mode
            elements.editBtn.style.display = 'inline-block';
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.toggleCenterColumn(elements, true, () => {
                 if (activeChart) activeChart.resize();
            });
            workspaceUI.updateEditModeUI(elements);
            elements.activeMeasurementName.textContent = name;
            await loadActiveMeasurementData();
        }
        refreshMeasurementList();
    }

    async function loadActiveMeasurementData() {
        if (!state.activeMeasurement) return;

        try {
            const data = await api.getMeasurementPoints(state.activeMeasurement);
            const points = data.points;

            elements.measurementDateInput.value = data.date || '';
            elements.measurementSerialIdInput.value = data.serial_id || '';
            elements.measurementSpindleSelect.value = data.spindle_id || '';

            workspaceUI.renderPointsTable(elements, points, handleDeletePoint);
            renderActiveChart(points);
        } catch (error) {
            console.error(`Error loading data for ${state.activeMeasurement}:`, error);
        }
    }

    function renderActiveChart(points) {
        const chartData = {
            datasets: [{
                label: state.activeMeasurement,
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
        refreshMeasurementList();
    }

    function handleMeasurementSearch() {
        stateManager.setMeasurementFilter(elements.measurementSearchInput.value);
        refreshMeasurementList();
    }

    async function handleAddMeasurement() {
        const lockAcquired = await ensureLock();
        if (!lockAcquired) return;

        try {
            // Create a draft with a default name on the backend
            const result = await api.addMeasurement();
            const newName = result.name;

            // Update local state and UI to point to this new measurement
            stateManager.setActiveMeasurement(newName);
            elements.activeMeasurementName.textContent = newName;
            elements.activeMeasurementNameInput.value = newName;

            // Show the center column if it was hidden
            workspaceUI.toggleCenterColumn(elements, true);

            // We are already in draft mode on the backend, so we just update the frontend state
            stateManager.setEditingOriginalName(null); // Marker for a NEW measurement
            stateManager.setEditing(true);
            elements.editBtn.style.display = 'inline-block'; // Ensure it's visible
            elements.editBtn.textContent = 'Save';
            elements.cancelEditBtn.style.display = 'inline-block';
            workspaceUI.updateEditModeUI(elements);

            // Clear any old data and prepare for entry
            workspaceUI.renderPointsTable(elements, [], handleDeletePoint);
            workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
            if (activeChart) chartService.destroyChart(activeChart);

            // Refresh the measurement list so the new draft name shows up
            await loadAndRenderMeasurements();

        } catch (error) {
            alert(error.message);
            await releaseLockIfPossible();
        }
    }

    async function handleDeleteMeasurement(name) {
        const targetName = name || state.activeMeasurement;
        if (!targetName) return;

        if (confirm(`Are you sure you want to delete the measurement "${targetName}"?`)) {
            const lockAcquired = await ensureLock();
            if (!lockAcquired) return;

            try {
                await api.deleteMeasurement(targetName);
                if (state.activeMeasurement === targetName) {
                    stateManager.setActiveMeasurement(null);
                    workspaceUI.toggleCenterColumn(elements, false);
                    elements.activeMeasurementName.textContent = 'No Measurement Selected';
                    if (activeChart) {
                        chartService.destroyChart(activeChart);
                        activeChart = null;
                    }
                }
                loadAndRenderMeasurements();
            } catch (error) {
                alert(error.message);
            } finally {
                await releaseLockIfPossible();
            }
        }
    }

    async function startEditMode() {
        if (!state.activeMeasurement) return;

        const lockAcquired = await ensureLock();
        if (!lockAcquired) return;

        try {
            await api.startEdit(state.activeMeasurement);

            stateManager.setEditingOriginalName(state.activeMeasurement); // Store for potential rollback
            stateManager.setEditing(true);
            elements.editBtn.textContent = 'Save';
            elements.cancelEditBtn.style.display = 'inline-block';
            workspaceUI.updateEditModeUI(elements);

            // Reload to get the new DRAFT IDs for points
            await loadActiveMeasurementData();

            workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
        } catch (error) {
            alert(error.message);
        }
    }

    async function commitEditMode() {
        try {
            // Ensure all rows are synced before committing
            const rows = Array.from(elements.pointsTableBody.querySelectorAll('tr'));
            const syncPromises = rows.map(row => syncTableRow(row));
            await Promise.all(syncPromises);

            const response = await api.commitEdit(state.activeMeasurement);
            const finalName = response.name || state.activeMeasurement;

            stateManager.setEditing(false);
            stateManager.setEditingOriginalName(null);
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);

            stateManager.setActiveMeasurement(finalName);
            elements.activeMeasurementName.textContent = finalName;

            await loadActiveMeasurementData();
            loadAndRenderMeasurements(); // Refresh list to reflect potential name change

            await releaseLockIfPossible();
        } catch (error) {
            alert(error.message);
        }
    }

    async function cancelEditMode() {
        try {
            const isNewMeasurement = (state.editingOriginalName === null);
            // Use the current active measurement name to hit the rollback API
            await api.rollbackEdit(state.activeMeasurement);

            if (isNewMeasurement) {
                // If it was a new unsaved measurement, we have nothing to revert to
                stateManager.setActiveMeasurement(null);
                elements.activeMeasurementName.textContent = 'No Measurement Selected';
                workspaceUI.toggleCenterColumn(elements, false);
            } else {
                // If the name was changed during draft, we must revert to the original name
                if (state.activeMeasurement !== state.editingOriginalName) {
                    stateManager.setActiveMeasurement(state.editingOriginalName);
                    elements.activeMeasurementName.textContent = state.editingOriginalName;
                }
            }

            stateManager.setEditing(false);
            stateManager.setEditingOriginalName(null);
            elements.editBtn.textContent = 'Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);

            if (!isNewMeasurement) {
                await loadActiveMeasurementData(); // Reload original data
            }

            await loadAndRenderMeasurements(); // Refresh list to remove the draft if it was new
            await releaseLockIfPossible();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleMeasurementRename() {
        if (!state.activeMeasurement || !state.isEditing) return;
        const newName = elements.activeMeasurementNameInput.value.trim();
        if (newName === state.activeMeasurement) return;
        if (!newName) {
            alert("Measurement name cannot be empty.");
            elements.activeMeasurementNameInput.value = state.activeMeasurement;
            return;
        }

        try {
            await api.updateMetadata(state.activeMeasurement, { name: newName });
            stateManager.setActiveMeasurement(newName);
            elements.activeMeasurementName.textContent = newName;
            loadAndRenderMeasurements(); // Refresh list
        } catch (error) {
            console.error('Failed to rename:', error);
            alert(error.message);
            elements.activeMeasurementNameInput.value = state.activeMeasurement;
        }
    }

    async function handleMetadataChange() {
        if (!state.activeMeasurement || !state.isEditing) return;
        const date = elements.measurementDateInput.value;
        const serialId = elements.measurementSerialIdInput.value;
        const spindleId = elements.measurementSpindleSelect.value;
        try {
            await api.updateMetadata(state.activeMeasurement, {
                date: date,
                serial_id: serialId,
                spindle_id: spindleId
            });
            // Reload all data after metadata change, especially for spindle-based recalculations
            await loadActiveMeasurementData();
        } catch (error) {
            console.error('Failed to update metadata:', error);
            alert('Failed to save metadata.');
        }
    }

    // Points Logic
    async function handleDeletePoint(pointId) {
        if (!state.activeMeasurement || !state.isEditing) return;
        if (confirm('Are you sure you want to delete this point?')) {
            try {
                await api.deletePoint(state.activeMeasurement, pointId);
                await loadActiveMeasurementData();
                workspaceUI.ensureEmptyRow(elements, handleDeletePoint); // Ensure we still have an empty row
            } catch (error) {
                alert(error.message);
            }
        }
    }

    async function syncTableRow(tr) {
        if (!state.isEditing) return;

        // --- Check for Spindle ---
        const spindleId = elements.measurementSpindleSelect.value;
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
                result = await api.updatePoint(state.activeMeasurement, id, nVal, etaVal, torqueVal);
                chartNeedsUpdate = true;
            } else {
                // Create new point - LOCK to prevent duplicates if user is still typing
                if (pendingAdds.has(tr)) return;
                pendingAdds.add(tr);
                try {
                    result = await api.addPoint(state.activeMeasurement, nVal, etaVal, torqueVal);
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
                const data = await api.getMeasurementPoints(state.activeMeasurement);
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
        if (!state.activeMeasurement || !activeChart) return;
        try {
            const regressionData = await api.getRegressionData(state.activeMeasurement, type);

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
        if (selectedNames.length === 0) return alert('Select measurements.');

        try {
            const chartData = await chartService.getSelectedMeasurementsForChart(selectedNames);
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
    elements.measurementSearchInput.addEventListener('input', handleMeasurementSearch);
    elements.measurementListHeaders.forEach(th => th.addEventListener('click', handleSort));
    elements.addMeasurementBtn.addEventListener('click', handleAddMeasurement);

    elements.editBtn.addEventListener('click', () => {
        if (!state.isEditing) {
            startEditMode();
        } else {
            commitEditMode();
        }
    });
    elements.cancelEditBtn.addEventListener('click', cancelEditMode);

    elements.deleteMeasurementBtn.addEventListener('click', () => handleDeleteMeasurement(state.activeMeasurement));
    elements.activeMeasurementNameInput.addEventListener('change', handleMeasurementRename);

    elements.measurementDateInput.addEventListener('change', handleMetadataChange);
    elements.measurementSerialIdInput.addEventListener('change', handleMetadataChange);
    elements.measurementSpindleSelect.addEventListener('change', handleMetadataChange);

    elements.pointsTableBody.addEventListener('input', handleTableNumericValidation);
    elements.pointsTableBody.addEventListener('change', handleTableInput);

    elements.openAnalysisBtn.addEventListener('click', () => analysisWindow.show());
    elements.regressionBtn.addEventListener('click', () => handleRegression('linear'));
    elements.powerRegressionBtn.addEventListener('click', () => handleRegression('power'));
    elements.clearRegressionBtn.addEventListener('click', clearRegressions);

    elements.drawSelectedBtn.addEventListener('click', handleDrawSelected);


    // --- Initial Load & Polling ---
    initUserConfig();
    loadAndRenderMeasurements();
    pollLockStatus();
    setInterval(pollLockStatus, 10000); // Poll lock status every 10s
});
