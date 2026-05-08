// static/js/main.js
import * as api from './api.js';
import * as chartService from './chart_service.js';
import state, * as stateManager from './state.js';
import * as layout from './ui/layout.js';
import * as measurementUI from './ui/measurement_ui.js';
import * as workspaceUI from './ui/workspace_ui.js';
import { createFloatingLegend, makeDraggable } from './ui/legend_ui.js';
import { TableResizer } from './ui/table_resizer.js';
import { ColumnReorderer } from './ui/column_reorderer.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        // Left Column
        measurementListTable: document.getElementById('measurement-list-table'),
        measurementListBody: document.getElementById('measurement-list-body'),
        measurementSearchInput: document.getElementById('measurement-search'),
        measurementListHeaders: document.querySelectorAll('#measurement-list-table th[data-sort]'),
        masterPlotCheckbox: document.getElementById('master-plot-checkbox'),
        addMeasurementBtn: document.getElementById('add-measurement-btn'),

        // Lock & User UI
        lockStatusText: document.getElementById('lock-status-text'),
        usernameInput: document.getElementById('username-input'),

        // Center Column
        centerColumn: document.getElementById('center-column'),
        activeMeasurementId: document.getElementById('active-measurement-id'),
        activeMeasurementNameInput: document.getElementById('active-measurement-name-input'),
        editBtn: document.getElementById('edit-btn'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        deleteMeasurementBtn: document.getElementById('delete-measurement-btn'),
        measurementDateInput: document.getElementById('measurement-date'),
        measurementSerialIdInput: document.getElementById('measurement-serial-id'),
        measurementNoteInput: document.getElementById('measurement-note'),
        measurementSpindleSelect: document.getElementById('measurement-spindle'),
        pointsTable: document.getElementById('points-table'),
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
        resetZoomBtn: document.getElementById('reset-zoom-btn'),
        comparisonChartTitle: document.getElementById('comparison-chart-title'),
        comparisonChartContainer: document.getElementById('comparison-chart-container'),
        saveChartBtn: document.getElementById('save-chart-btn'),
        exportFormat: document.getElementById('export-format'),
        exportDpi: document.getElementById('export-dpi'),
        comparisonChartCanvas: document.getElementById('comparison-chart').getContext('2d'),
        customLegend: document.getElementById('custom-legend'),
        toggleChartControlsBtn: document.getElementById('toggle-chart-controls'),
        toggleLegendBtn: document.getElementById('toggle-legend'),
        compChartControls: document.getElementById('comp-chart-controls'),

        // Chart Controls
        toggleCompLogX: document.getElementById('toggle-comp-log-x'),
        toggleCompLogY: document.getElementById('toggle-comp-log-y'),
        compIncludeLinear: document.getElementById('comp-include-linear'),
        compIncludePower: document.getElementById('comp-include-power'),
        toggleActiveLogX: document.getElementById('toggle-active-log-x'),
        toggleActiveLogY: document.getElementById('toggle-active-log-y'),
        activeIncludeLinear: document.getElementById('active-include-linear'),
        activeIncludePower: document.getElementById('active-include-power'),
        resetActiveZoomBtn: document.getElementById('reset-active-zoom-btn'),

        // Custom Curve Controls
        customCurveName: document.getElementById('custom-curve-name'),
        customCurveType: document.getElementById('custom-curve-type'),
        customCurveFormulaPreview: document.getElementById('custom-curve-formula-preview'),
        customCurveParam1Label: document.getElementById('custom-curve-param1-label'),
        customCurveParam2Label: document.getElementById('custom-curve-param2-label'),
        customCurveParam1: document.getElementById('custom-curve-param1'),
        customCurveParam2: document.getElementById('custom-curve-param2'),
        customCurveColor: document.getElementById('custom-curve-color'),
        addCustomCurveBtn: document.getElementById('add-custom-curve-btn'),
        clearCustomCurvesBtn: document.getElementById('clear-custom-curves-btn'),

        // Comparison Chart Limits
        compXMin: document.getElementById('comp-x-min'),
        compXMax: document.getElementById('comp-x-max'),
        applyXLimits: document.getElementById('apply-x-limits'),
        clearXLimits: document.getElementById('clear-x-limits'),
        compYMin: document.getElementById('comp-y-min'),
        compYMax: document.getElementById('comp-y-max'),
        applyYLimits: document.getElementById('apply-y-limits'),
        clearYLimits: document.getElementById('clear-y-limits'),
        customCurvesList: document.getElementById('custom-curves-list'),
        referenceCurvesList: document.getElementById('reference-curves-list'),

        // Layout
        leftColumn: document.getElementById('left-column'),
        centerColumn: document.getElementById('center-column'),
        rightColumn: document.getElementById('right-column'),
        collapseLeftBtn: document.getElementById('collapse-left'),
        collapseCenterBtn: document.getElementById('collapse-center'),
        gutterLeft: document.getElementById('gutter-left'),
        gutterCenter: document.getElementById('gutter-center'),

        // Dialogs
        unsavedChangesDialog: document.getElementById('unsaved-changes-dialog'),
        unsavedSaveBtn: document.getElementById('unsaved-save-btn'),
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

    // --- Table Resizing ---
    new TableResizer(elements.measurementListTable, 'table-widths-measurements');
    new TableResizer(elements.pointsTable, 'table-widths-points');

    // --- Table Column Reordering ---
    new ColumnReorderer(elements.measurementListTable, 'table-column-order-measurements', () => {
        refreshMeasurementList();
    });

    // Extra observer for the right column (which isn't a ResizableColumn itself)
    let rightColumnResizeTimer;
    const rightColumnObserver = new ResizeObserver(() => {
        cancelAnimationFrame(rightColumnResizeTimer);
        rightColumnResizeTimer = requestAnimationFrame(() => {
            if (comparisonChart) comparisonChart.resize();
        });
    });
    rightColumnObserver.observe(elements.rightColumn);

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
            stateManager.setEditingOriginalId(null);
            elements.editBtn.textContent = '✎ Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);
            loadActiveMeasurementData();
        }
    }

    // 1. Data Loading & List Management
    async function loadAndRenderMeasurements() {
        try {
            const measurements = await api.fetchMeasurements();
            stateManager.setAllMeasurements(measurements);
            refreshMeasurementList();

            // Fetch Reference Curves
            const refCurves = await api.fetchReferenceCurves();
            state.chartConfig.comparison.referenceCurves = refCurves;
            renderReferenceCurvesList();
        } catch (error) {
            console.error('Error loading measurements:', error);
        }
    }

    function renderReferenceCurvesList() {
        if (!elements.referenceCurvesList) return;
        elements.referenceCurvesList.innerHTML = '';

        state.chartConfig.comparison.referenceCurves.forEach(curve => {
            const row = document.createElement('div');
            row.className = 'control-group';
            row.style.justifyContent = 'flex-start';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `ref-curve-${curve.id}`;
            checkbox.checked = state.chartConfig.comparison.selectedReferenceCurves.has(curve.id);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    state.chartConfig.comparison.selectedReferenceCurves.add(curve.id);
                } else {
                    state.chartConfig.comparison.selectedReferenceCurves.delete(curve.id);
                }
                handleDrawSelected();
            });

            const label = document.createElement('label');
            label.htmlFor = `ref-curve-${curve.id}`;
            label.className = 'checkbox-label';
            label.textContent = curve.name;

            // Add a small color indicator
            const colorIndicator = document.createElement('span');
            colorIndicator.style.display = 'inline-block';
            colorIndicator.style.width = '12px';
            colorIndicator.style.height = '12px';
            colorIndicator.style.backgroundColor = curve.color;
            colorIndicator.style.borderRadius = '2px';

            row.appendChild(checkbox);
            row.appendChild(label);
            row.appendChild(colorIndicator);

            if (curve.formula) {
                const formulaDiv = document.createElement('div');
                formulaDiv.className = 'formula-display';
                formulaDiv.style.marginLeft = '5px';
                formulaDiv.style.fontSize = '0.8rem';
                formulaDiv.innerHTML = curve.formula;
                row.appendChild(formulaDiv);

                if (typeof renderMathInElement === 'function') {
                    renderMathInElement(formulaDiv, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false}
                        ],
                        throwOnError: false
                    });
                }
            }

            elements.referenceCurvesList.appendChild(row);
        });
    }

    function refreshMeasurementList() {
        measurementUI.renderMeasurementList(elements, setActiveMeasurement, handleDrawSelected);
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
    async function setActiveMeasurement(id) {
        // --- Handle Unsaved Changes ---
        if (state.isEditing && state.activeMeasurement) {
            const wasSame = (id === state.activeMeasurement);
            // If clicking a different measurement OR clicking the same one to deselect
            const action = await showUnsavedChangesDialog();

            if (action === 'save') {
                await commitEditMode();
                if (wasSame) return; // Already handled active measurement transition
            } else if (action === 'discard') {
                await cancelEditMode();
                if (wasSame) return; // Already handled active measurement transition
            } else {
                // "stay" or dialog closed without action
                refreshMeasurementList();
                return;
            }
        }

        if (state.activeMeasurement === id) {
            // Deselect
            stateManager.setActiveMeasurement(null);
            workspaceUI.toggleCenterColumn(elements, false);
            elements.editBtn.style.display = 'none';
            elements.cancelEditBtn.style.display = 'none';
        } else {
            // Select
            // Check if the measurement still exists (it might have been a cancelled draft)
            const m = state.allMeasurements.find(m => m.pkey === id);
            if (!m) {
                if (id !== null) console.warn(`Measurement PKEY ${id} not found in state.`);
                return;
            }

            stateManager.setActiveMeasurement(id);
            stateManager.setEditing(false); // Reset edit mode
            elements.editBtn.style.display = 'inline-block';
            elements.editBtn.textContent = '✎ Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.toggleCenterColumn(elements, true, () => {
                 if (activeChart) activeChart.resize();
            });
            workspaceUI.updateEditModeUI(elements);

            await loadActiveMeasurementData();
        }
        refreshMeasurementList();
    }

    async function loadActiveMeasurementData() {
        if (!state.activeMeasurement) return;

        try {
            const data = await api.fetchMeasurementData(state.activeMeasurement);
            const points = data.points;
            const logicalId = data.original_id || data.pkey;

            elements.activeMeasurementId.value = logicalId;
            elements.activeMeasurementNameInput.value = data.formula_id;
            elements.measurementDateInput.value = data.date || '';
            elements.measurementSerialIdInput.value = data.serial_id || '';
            elements.measurementNoteInput.value = data.experiment_note || '';
            elements.measurementSpindleSelect.value = data.spindle_id || '';

            workspaceUI.renderPointsTable(elements, points, handleDeletePoint);
            renderActiveChart(data);
            updateSaveButtonState();
        } catch (error) {
            console.error(`Error loading data for ID ${state.activeMeasurement}:`, error);
        }
    }

    async function renderActiveChart(measurementData) {
        if (!state.activeMeasurement) return;

        const points = measurementData.points;
        const displayName = `${measurementData.formula_id} - ${measurementData.pkey}`;

        const datasets = [{
            label: displayName,
            data: points.map(p => ({ x: p.shear_rate, y: p.shear_stress })),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            pointRadius: 5,
            pointHoverRadius: 7,
            type: 'scatter'
        }];

        // Add Regressions if enabled
        if (state.chartConfig.active.includeLinear) {
            try {
                const reg = await api.fetchRegression(state.activeMeasurement, 'linear');
                datasets.push(createRegressionDataset(displayName, reg, 'linear', 'rgba(255, 99, 132, 1)'));
            } catch (e) { console.warn('Active linear reg failed', e); }
        }

        if (state.chartConfig.active.includePower) {
            try {
                const reg = await api.fetchRegression(state.activeMeasurement, 'power');
                datasets.push(createRegressionDataset(displayName, reg, 'power', 'rgba(54, 162, 235, 1)'));
            } catch (e) { console.warn('Active power reg failed', e); }
        }

        const chartOptions = {
            xAxisType: state.chartConfig.active.xLog ? 'logarithmic' : 'linear',
            yAxisType: state.chartConfig.active.yLog ? 'logarithmic' : 'linear'
        };

        if (activeChart) chartService.destroyChart(activeChart);
        activeChart = chartService.initializeOrUpdateChart(elements.activeChartCanvas, datasets, chartOptions);
        elements.resetActiveZoomBtn.style.display = 'flex';
    }

    // Helper for creating regression datasets
    function createRegressionDataset(name, regData, type, color) {
        const points = regData.regression_points.map(p => ({ x: p.shear_rate, y: p.shear_stress }));
        let label;
        const r2 = regData.r_squared.toFixed(3);

        if (type === 'linear') {
            const { slope, intercept } = regData;
            label = `${name} (Linear): $\\sigma = ${slope.toFixed(3)}\\dot{\\gamma} ${intercept >= 0 ? '+' : ''} ${intercept.toFixed(3)}, R^2=${r2}$`;
        } else {
            const { a, b } = regData;
            label = `${name} (Power): $\\sigma = ${a.toFixed(3)}\\dot{\\gamma}^{${b.toFixed(3)}}, R^2=${r2}$`;
        }

        return {
            label: label,
            data: points,
            borderColor: color,
            borderWidth: 2,
            borderDash: type === 'linear' ? [10, 5] : [5, 5],
            backgroundColor: 'rgba(0,0,0,0)',
            type: 'line',
            showLine: true,
            fill: false,
            pointRadius: 0,
            hitRadius: 15,
            pointHitRadius: 15,
            tension: 0.1
        };
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

    function updateSaveButtonState() {
        if (!state.isEditing) return;

        const liquidName = elements.activeMeasurementNameInput.value.trim();
        const date = elements.measurementDateInput.value.trim();
        const serialId = elements.measurementSerialIdInput.value.trim();
        const spindleId = elements.measurementSpindleSelect.value;

        // Simple date format check: YYYY-MM-DD or YYYY/MM/DD
        const dateRegex = /^\d{4}[-/]\d{2}[-/]\d{2}$/;
        const isDateValid = dateRegex.test(date);

        // Toggle validation error class for visual feedback
        elements.activeMeasurementNameInput.classList.toggle('validation-error', !liquidName);
        elements.measurementDateInput.classList.toggle('validation-error', !isDateValid);
        elements.measurementSerialIdInput.classList.toggle('validation-error', !serialId);
        elements.measurementSpindleSelect.classList.toggle('validation-error', !spindleId);

        const isValid = liquidName && isDateValid && serialId && spindleId;
        elements.editBtn.disabled = !isValid;
        elements.unsavedSaveBtn.disabled = !isValid;
    }

    function markDirty() {
        if (!state.isEditing) return;
        stateManager.setDirty(true);
    }

    async function handleAddMeasurement() {
        if (state.isEditing) {
            const action = await showUnsavedChangesDialog();
            if (action === 'save') {
                await commitEditMode();
            } else if (action === 'discard') {
                await cancelEditMode();
            } else {
                return;
            }
        }

        if (elements.addMeasurementBtn.disabled) return;
        elements.addMeasurementBtn.disabled = true;

        const lockAcquired = await ensureLock();
        if (!lockAcquired) {
            elements.addMeasurementBtn.disabled = false;
            return;
        }

        try {
            // Create a draft with a default name on the backend
            const result = await api.createMeasurement("New Measurement");
            const newId = result.pkey;

            // Update local state and UI to point to this new measurement
            stateManager.setActiveMeasurement(newId);

            // CLEAR INPUTS as per request
            elements.activeMeasurementId.value = newId; // Show the new ID
            elements.activeMeasurementNameInput.value = "";
            elements.measurementDateInput.value = "";
            elements.measurementSerialIdInput.value = "";
            elements.measurementNoteInput.value = "";
            elements.measurementSpindleSelect.value = "";

            // Show the center column if it was hidden
            workspaceUI.toggleCenterColumn(elements, true);

            // We are already in draft mode on the backend, so we just update the frontend state
            stateManager.setEditingOriginalId(null); // Marker for a NEW measurement
            stateManager.setEditing(true);
            stateManager.setDirty(false); // New measurement starts clean
            elements.editBtn.style.display = 'inline-block'; // Ensure it's visible
            elements.editBtn.textContent = '💾 Save';
            elements.cancelEditBtn.style.display = 'inline-block';
            workspaceUI.updateEditModeUI(elements);

            updateSaveButtonState(); // Initialize disabled state

            // Clear any old data and prepare for entry
            workspaceUI.renderPointsTable(elements, [], handleDeletePoint);
            workspaceUI.ensureEmptyRow(elements, handleDeletePoint);
            if (activeChart) {
                chartService.destroyChart(activeChart);
                activeChart = null;
            }

            // Refresh the measurement list so the new draft shows up
            await loadAndRenderMeasurements();

        } catch (error) {
            alert(error.message);
            await releaseLockIfPossible();
        } finally {
            elements.addMeasurementBtn.disabled = false;
        }
    }

    async function handleDeleteMeasurement(id) {
        // If no specific ID passed, prioritize original ID if editing, otherwise use active ID
        const targetId = id || state.editingOriginalId || state.activeMeasurement;
        if (!targetId) return;

        // Use the logical ID (original if available) for the confirmation message
        const m = state.allMeasurements.find(item => item.pkey === targetId);
        const displayName = m ? m.formula_id : `ID: ${targetId}`;

        if (confirm(`Are you sure you want to delete "${displayName}"?`)) {
            const lockAcquired = await ensureLock();
            if (!lockAcquired) return;

            try {
                // Store draft ID to clean up comparison selection
                const draftIdToDelete = (state.isEditing && state.activeMeasurement !== targetId) ? state.activeMeasurement : null;

                await api.deleteMeasurement(targetId);

                // Cleanup comparison selection for both original and draft IDs
                state.comparisonSelected.delete(targetId);
                if (draftIdToDelete) {
                    state.comparisonSelected.delete(draftIdToDelete);
                }
                handleDrawSelected();

                // If deleting the currently viewed/edited measurement, reset the workspace
                const isCurrentActive = (state.activeMeasurement === targetId) ||
                                        (state.isEditing && state.editingOriginalId === targetId);

                if (isCurrentActive) {
                    stateManager.setActiveMeasurement(null);
                    stateManager.setEditing(false);
                    stateManager.setEditingOriginalId(null);

                    workspaceUI.toggleCenterColumn(elements, false);
                    elements.editBtn.textContent = '✎ Edit';
                    elements.cancelEditBtn.style.display = 'none';
                    workspaceUI.updateEditModeUI(elements);

                    if (activeChart) {
                        chartService.destroyChart(activeChart);
                        activeChart = null;
                    }
                }
                await loadAndRenderMeasurements();
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
            const result = await api.startEditMode(state.activeMeasurement);
            const draftId = result.pkey;

            stateManager.setEditingOriginalId(state.activeMeasurement); // Store for potential rollback
            stateManager.setActiveMeasurement(draftId); // Backend returned the draft ID
            stateManager.setEditing(true);
            stateManager.setDirty(false); // Start clean
            elements.editBtn.textContent = '📄 Save';
            elements.cancelEditBtn.style.display = 'inline-block';
            workspaceUI.updateEditModeUI(elements);

            // Reload to get the new DRAFT IDs for points
            await loadActiveMeasurementData();
            updateSaveButtonState();

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

            const response = await api.commitEditMode(state.activeMeasurement);
            const finalId = response.pkey || state.activeMeasurement;

            stateManager.setEditing(false);
            stateManager.setEditingOriginalId(null);
            stateManager.setDirty(false);
            elements.editBtn.textContent = '✎ Edit';
            elements.cancelEditBtn.style.display = 'none';
            workspaceUI.updateEditModeUI(elements);

            stateManager.setActiveMeasurement(finalId);
            await loadActiveMeasurementData();
            loadAndRenderMeasurements(); // Refresh list to reflect potential name change

            await releaseLockIfPossible();
        } catch (error) {
            alert(error.message);
        }
    }

    async function cancelEditMode() {
        try {
            const isNewMeasurement = (state.editingOriginalId === null);
            await api.rollbackEditMode(state.activeMeasurement);

            if (isNewMeasurement) {
                stateManager.setActiveMeasurement(null);
                workspaceUI.toggleCenterColumn(elements, false);
            } else {
                stateManager.setActiveMeasurement(state.editingOriginalId);
            }

            stateManager.setEditing(false);
            stateManager.setEditingOriginalId(null);
            stateManager.setDirty(false);
            elements.editBtn.textContent = '✎ Edit';
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
        markDirty();
        const newName = elements.activeMeasurementNameInput.value.trim();

        updateSaveButtonState(); // Update UI state immediately

        if (!newName) return;

        try {
            await api.updateMeasurementMetadata(state.activeMeasurement, { formula_id: newName });
            loadAndRenderMeasurements(); // Refresh list
        } catch (error) {
            console.error('Failed to rename:', error);
            alert(error.message);
            updateSaveButtonState();
        }
    }

    async function handleMetadataChange() {
        if (!state.activeMeasurement || !state.isEditing) return;
        markDirty();
        const date = elements.measurementDateInput.value;
        const serialId = elements.measurementSerialIdInput.value;
        const experimentNote = elements.measurementNoteInput.value;
        const spindleId = elements.measurementSpindleSelect.value;
        try {
            await api.updateMeasurementMetadata(state.activeMeasurement, {
                date: date,
                serial_id: serialId,
                experiment_note: experimentNote,
                spindle_id: spindleId
            });
            // Clear cache as points might be recalculated
            chartService.clearChartCache(state.activeMeasurement);
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
                await api.deleteDataPoint(state.activeMeasurement, pointId);
                chartService.clearChartCache(state.activeMeasurement);
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
                result = await api.updateDataPoint(state.activeMeasurement, id, { N: nVal, eta: etaVal, torque: torqueVal });
                chartService.clearChartCache(state.activeMeasurement);
                chartNeedsUpdate = true;
            } else {
                // Create new point - LOCK to prevent duplicates if user is still typing
                if (pendingAdds.has(tr)) return;
                pendingAdds.add(tr);
                try {
                    result = await api.addDataPoint(state.activeMeasurement, { N: nVal, eta: etaVal, torque: torqueVal });
                    chartService.clearChartCache(state.activeMeasurement);
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
                const data = await api.fetchMeasurementData(state.activeMeasurement);
                renderActiveChart(data);
            } catch (error) { console.error('Chart reload failed:', error); }
        }
    }

    function handleTableNumericValidation(e) {
        if (e.target.tagName !== 'INPUT') return;
        const input = e.target;
        const rawVal = input.value;

        markDirty();

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

    function renderCustomCurvesList() {
        if (!elements.customCurvesList) return;
        elements.customCurvesList.innerHTML = '';

        state.chartConfig.comparison.customCurves.forEach(curve => {
            const badge = document.createElement('div');
            badge.className = 'custom-curve-badge';
            badge.style.borderLeft = `4px solid ${curve.color}`;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = curve.name;
            badge.appendChild(nameSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.className = 'delete-curve-btn';
            deleteBtn.addEventListener('click', () => {
                state.chartConfig.comparison.customCurves = state.chartConfig.comparison.customCurves.filter(c => c.id !== curve.id);
                renderCustomCurvesList();
                handleDrawSelected();
            });
            badge.appendChild(deleteBtn);

            elements.customCurvesList.appendChild(badge);
        });
    }

    async function handleSaveChart() {
        if (!elements.comparisonChartContainer) return;

        // Blur title to remove cursor/focus during export
        if (document.activeElement === elements.comparisonChartTitle) {
            elements.comparisonChartTitle.blur();
        }

        const originalBtnText = elements.saveChartBtn.textContent;
        elements.saveChartBtn.textContent = '⌛ Exporting...';
        elements.saveChartBtn.disabled = true;

        const format = elements.exportFormat.value;
        const scale = parseFloat(elements.exportDpi.value) || 1;

        // Temporarily boost Chart.js resolution for the export
        // We use window.devicePixelRatio as base and multiply by our scale factor
        let originalDPR = window.devicePixelRatio || 1;
        if (comparisonChart) {
            originalDPR = comparisonChart.options.devicePixelRatio || window.devicePixelRatio || 1;
            comparisonChart.options.devicePixelRatio = window.devicePixelRatio * scale;
            comparisonChart.resize();
        }

        try {
            // Options for dom-to-image-more
            const options = {
                bgcolor: '#ffffff',
                scale: scale,
                filter: (node) => {
                    // Skip the reset zoom button, the export control group, and the spacer
                    return !(node.id === 'reset-zoom-btn' || node.id === 'export-controls-group' || node.id === 'export-spacer');
                }
            };

            let dataUrl;
            if (format === 'svg') {
                dataUrl = await domtoimage.toSvg(elements.comparisonChartContainer, options);

                // Use fetch to reliably decode the data URL (handles base64/URI encoding automatically)
                const response = await fetch(dataUrl);
                let svgString = await response.text();

                // 1. Ensure XHTML compliance: Close self-closing tags (input, img, br, hr)
                // This is critical for SVG foreignObject content.
                svgString = svgString.replace(/<(input|img|br|hr)([^>]*?)(\/?)>/gi, (match, tag, attrs, closed) => {
                    return (closed && closed.includes('/')) ? match : `<${tag}${attrs} />`;
                });

                // 2. Escape raw ampersands that aren't part of an XML entity
                svgString = svgString.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;');

                const width = elements.comparisonChartContainer.offsetWidth;
                const height = elements.comparisonChartContainer.offsetHeight;

                // 3. Robust SVG Header Normalization
                // We use a helper to ensure attributes are present exactly once.
                svgString = svgString.replace(/<svg([^>]*?)>/i, (match, attrs) => {
                    let a = attrs;
                    // Remove existing problematic attributes to re-add them cleanly
                    a = a.replace(/xmlns="[^"]*"/gi, '');
                    a = a.replace(/version="[^"]*"/gi, '');
                    a = a.replace(/viewBox="[^"]*"/gi, '');
                    a = a.replace(/width="[^"]*"/gi, '');
                    a = a.replace(/height="[^"]*"/gi, '');

                    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${a}>`;
                });

                // 4. Add XHTML namespace to the internal container div
                // Standalone viewers require this to render the HTML content correctly.
                svgString = svgString.replace(/<div([^>]*?id="comparison-chart-container"[^>]*?)>/i, (match, attrs) => {
                    if (attrs.includes('xmlns=')) return match;
                    return `<div${attrs} xmlns="http://www.w3.org/1999/xhtml">`;
                });

                // 5. Convert all relative dimensions in the SVG structure to absolute pixels
                // Percentage units in foreignObject are a common cause of failure in standalone viewers.
                svgString = svgString.replace(/width="100%"/gi, `width="${width}"`);
                svgString = svgString.replace(/height="100%"/gi, `height="${height}"`);

                // 6. Ensure XML Declaration is at the very top
                if (!svgString.trim().startsWith('<?xml')) {
                    svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;
                }

                const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
                dataUrl = URL.createObjectURL(blob);
            } else {
                dataUrl = await domtoimage.toPng(elements.comparisonChartContainer, options);
            }

            const link = document.createElement('a');
            const title = elements.comparisonChartTitle.textContent.trim() || 'Rheology_Compare';
            const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `${filename}.${format}`;
            link.href = dataUrl;
            link.click();

            if (format === 'svg') {
                URL.revokeObjectURL(dataUrl); // Clean up
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to save chart image.');
        } finally {
            // Restore original Chart.js resolution
            if (comparisonChart) {
                comparisonChart.options.devicePixelRatio = originalDPR;
                comparisonChart.resize();
            }
            elements.saveChartBtn.textContent = originalBtnText;
            elements.saveChartBtn.disabled = false;
        }
    }

    async function handleDrawSelected() {
        renderCustomCurvesList(); // Always refresh the management list
        const selectedIds = Array.from(state.comparisonSelected);
        const hasCustomCurves = state.chartConfig.comparison.customCurves.length > 0;
        const hasReferenceCurves = state.chartConfig.comparison.selectedReferenceCurves.size > 0;

        if (selectedIds.length === 0 && !hasCustomCurves && !hasReferenceCurves) {
            if (comparisonChart) {
                chartService.destroyChart(comparisonChart);
                comparisonChart = null;
            }
            elements.customLegend.style.display = 'none';
            elements.resetZoomBtn.style.display = 'none';
            return;
        }

        try {
            const selectedReferenceCurves = state.chartConfig.comparison.referenceCurves.filter(
                c => state.chartConfig.comparison.selectedReferenceCurves.has(c.id)
            );

            const chartData = await chartService.getSelectedMeasurementsForChart(selectedIds, {
                includeLinear: state.chartConfig.comparison.includeLinear,
                includePower: state.chartConfig.comparison.includePower,
                customCurves: [
                    ...state.chartConfig.comparison.customCurves,
                    ...selectedReferenceCurves
                ]
            });

            const chartOptions = {
                xAxisType: state.chartConfig.comparison.xLog ? 'logarithmic' : 'linear',
                yAxisType: state.chartConfig.comparison.yLog ? 'logarithmic' : 'linear',
                xMin: state.chartConfig.comparison.xMin,
                xMax: state.chartConfig.comparison.xMax,
                yMin: state.chartConfig.comparison.yMin,
                yMax: state.chartConfig.comparison.yMax
            };

            if (comparisonChart) chartService.destroyChart(comparisonChart);
            comparisonChart = chartService.initializeOrUpdateChart(elements.comparisonChartCanvas, chartData.datasets, chartOptions);

            elements.resetZoomBtn.style.display = 'inline-flex';

            // Generate Custom Legend
            createFloatingLegend(comparisonChart, elements.customLegend, state.chartConfig.comparison.showLegend);
        } catch (error) {
            console.error(error);
        }
    }


    async function handleMasterPlotToggle() {
        const visibleMeasurements = measurementUI.getProcessedMeasurements();
        const shouldSelect = elements.masterPlotCheckbox.checked;

        visibleMeasurements.forEach(m => {
            if (shouldSelect) {
                state.comparisonSelected.add(m.pkey);
            } else {
                state.comparisonSelected.delete(m.pkey);
            }
        });

        // Trigger chart update
        handleDrawSelected();
        // Refresh list to update individual checkboxes
        refreshMeasurementList();
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
    elements.masterPlotCheckbox.addEventListener('change', handleMasterPlotToggle);
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

    elements.deleteMeasurementBtn.addEventListener('click', () => handleDeleteMeasurement());
    elements.saveChartBtn.addEventListener('click', handleSaveChart);
    const preventWhitespace = (e) => {
        if (e.key === ' ' || e.key === 'Tab') {
            e.preventDefault();
        }
    };

    const sanitizeWhitespace = (e) => {
        const input = e.target;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const originalValue = input.value;
        const sanitizedValue = originalValue.replace(/\s/g, '');

        if (originalValue !== sanitizedValue) {
            input.value = sanitizedValue;
            // Try to maintain cursor position
            const diff = originalValue.length - sanitizedValue.length;
            input.setSelectionRange(start - diff, end - diff);
        }
    };

    elements.activeMeasurementNameInput.addEventListener('keydown', preventWhitespace);
    elements.activeMeasurementNameInput.addEventListener('input', sanitizeWhitespace);
    elements.measurementSerialIdInput.addEventListener('keydown', preventWhitespace);
    elements.measurementSerialIdInput.addEventListener('input', sanitizeWhitespace);

    elements.activeMeasurementNameInput.addEventListener('change', handleMeasurementRename);
    elements.activeMeasurementNameInput.addEventListener('input', () => {
        updateSaveButtonState();
    });

    elements.measurementDateInput.addEventListener('change', handleMetadataChange);
    elements.measurementDateInput.addEventListener('input', updateSaveButtonState);

    elements.measurementSerialIdInput.addEventListener('change', handleMetadataChange);
    elements.measurementSerialIdInput.addEventListener('input', updateSaveButtonState);

    elements.measurementNoteInput.addEventListener('change', handleMetadataChange);
    elements.measurementNoteInput.addEventListener('input', updateSaveButtonState);

    elements.measurementSpindleSelect.addEventListener('change', handleMetadataChange);
    elements.measurementSpindleSelect.addEventListener('change', updateSaveButtonState);

    elements.pointsTableBody.addEventListener('input', handleTableNumericValidation);
    elements.pointsTableBody.addEventListener('change', handleTableInput);

    elements.openAnalysisBtn.addEventListener('click', () => analysisWindow.show());


    elements.resetZoomBtn.addEventListener('click', () => {
        if (comparisonChart) {
            comparisonChart.resetZoom();
        }
    });

    // --- Chart Control Listeners ---
    const updateCompChart = () => handleDrawSelected();
    const updateActiveChart = () => {
        if (state.activeMeasurement) loadActiveMeasurementData();
    };

    // Accordion Logic
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.addEventListener('click', function() {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.display === 'block') {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
            }
            // Trigger chart resize if needed because layout changed
            if (comparisonChart) {
                setTimeout(() => comparisonChart.resize(), 50);
            }
        });
    });

    elements.toggleChartControlsBtn.addEventListener('click', () => {
        const isCurrentlyVisible = elements.compChartControls.style.display !== 'none';

        if (isCurrentlyVisible) {
            elements.compChartControls.style.display = 'none';
            elements.toggleChartControlsBtn.classList.add('active'); // "Active" means controls are minimized/hidden
            elements.toggleChartControlsBtn.textContent = '⚙ Show Controls';
        } else {
            elements.compChartControls.style.display = 'block';
            elements.toggleChartControlsBtn.classList.remove('active');
            elements.toggleChartControlsBtn.textContent = '⚙ Hide Controls';
        }

        // Force chart resize to fill space
        if (comparisonChart) {
            setTimeout(() => {
                comparisonChart.resize();
            }, 50); // Slight delay for DOM layout
        }
    });

    elements.toggleLegendBtn.addEventListener('click', () => {
        state.chartConfig.comparison.showLegend = !state.chartConfig.comparison.showLegend;
        const isVisible = state.chartConfig.comparison.showLegend;

        elements.customLegend.style.display = isVisible ? 'flex' : 'none';
        elements.toggleLegendBtn.textContent = isVisible ? '🏷️ Hide Legend' : '🏷️ Show Legend';
        elements.toggleLegendBtn.classList.toggle('active', !isVisible);
    });

    elements.toggleCompLogX.addEventListener('click', () => {
        state.chartConfig.comparison.xLog = !state.chartConfig.comparison.xLog;
        elements.toggleCompLogX.classList.toggle('active', state.chartConfig.comparison.xLog);
        updateCompChart();
    });
    elements.toggleCompLogY.addEventListener('click', () => {
        state.chartConfig.comparison.yLog = !state.chartConfig.comparison.yLog;
        elements.toggleCompLogY.classList.toggle('active', state.chartConfig.comparison.yLog);
        updateCompChart();
    });
    elements.compIncludeLinear.addEventListener('change', () => {
        state.chartConfig.comparison.includeLinear = elements.compIncludeLinear.checked;
        updateCompChart();
    });
    elements.compIncludePower.addEventListener('change', () => {
        state.chartConfig.comparison.includePower = elements.compIncludePower.checked;
        updateCompChart();
    });

    elements.applyXLimits.addEventListener('click', () => {
        const minVal = parseFloat(elements.compXMin.value);
        const maxVal = parseFloat(elements.compXMax.value);
        state.chartConfig.comparison.xMin = isNaN(minVal) ? null : minVal;
        state.chartConfig.comparison.xMax = isNaN(maxVal) ? null : maxVal;
        updateCompChart();
    });

    elements.clearXLimits.addEventListener('click', () => {
        elements.compXMin.value = '';
        elements.compXMax.value = '';
        state.chartConfig.comparison.xMin = null;
        state.chartConfig.comparison.xMax = null;
        updateCompChart();
    });

    elements.applyYLimits.addEventListener('click', () => {
        const minVal = parseFloat(elements.compYMin.value);
        const maxVal = parseFloat(elements.compYMax.value);
        state.chartConfig.comparison.yMin = isNaN(minVal) ? null : minVal;
        state.chartConfig.comparison.yMax = isNaN(maxVal) ? null : maxVal;
        updateCompChart();
    });

    elements.clearYLimits.addEventListener('click', () => {
        elements.compYMin.value = '';
        elements.compYMax.value = '';
        state.chartConfig.comparison.yMin = null;
        state.chartConfig.comparison.yMax = null;
        updateCompChart();
    });

    function updateCurveFormulaPreview() {
        if (!elements.customCurveFormulaPreview || !elements.customCurveType) return;
        const type = elements.customCurveType.value;
        const latex = type === 'linear' ? '\\sigma = m\\dot{\\gamma} + c' : '\\sigma = a\\dot{\\gamma}^b';
        const p1Label = type === 'linear' ? 'm=' : 'a=';
        const p2Label = type === 'linear' ? 'c=' : 'b=';
        const p1Placeholder = type === 'linear' ? 'Slope' : 'Factor';
        const p2Placeholder = type === 'linear' ? 'Intercept' : 'Exponent';

        try {
            if (window.katex) {
                katex.render(latex, elements.customCurveFormulaPreview, { throwOnError: false });
                katex.render(p1Label, elements.customCurveParam1Label, { throwOnError: false });
                katex.render(p2Label, elements.customCurveParam2Label, { throwOnError: false });
            }
        } catch (e) {
            elements.customCurveFormulaPreview.textContent = latex;
            elements.customCurveParam1Label.textContent = p1Label;
            elements.customCurveParam2Label.textContent = p2Label;
        }
        elements.customCurveParam1.placeholder = p1Placeholder;
        elements.customCurveParam2.placeholder = p2Placeholder;
    }

    elements.customCurveType.addEventListener('change', updateCurveFormulaPreview);

    elements.addCustomCurveBtn.addEventListener('click', () => {
        const name = elements.customCurveName.value.trim();
        const type = elements.customCurveType.value;
        const param1 = parseFloat(elements.customCurveParam1.value);
        const param2 = parseFloat(elements.customCurveParam2.value);
        const color = elements.customCurveColor.value;

        if (isNaN(param1) || isNaN(param2)) {
            alert('Please enter valid numbers for both parameters.');
            return;
        }

        const newCurve = {
            id: 'custom-' + Date.now(),
            name: name || (type === 'linear' ? 'Custom Linear' : 'Custom Power'),
            type: type,
            param1: param1,
            param2: param2,
            color: color
        };

        state.chartConfig.comparison.customCurves.push(newCurve);

        // Reset inputs
        elements.customCurveName.value = '';
        elements.customCurveParam1.value = '';
        elements.customCurveParam2.value = '';

        updateCompChart();
    });

    elements.clearCustomCurvesBtn.addEventListener('click', () => {
        state.chartConfig.comparison.customCurves = [];
        renderCustomCurvesList();
        updateCompChart();
    });

    elements.toggleActiveLogX.addEventListener('click', () => {
        state.chartConfig.active.xLog = !state.chartConfig.active.xLog;
        elements.toggleActiveLogX.classList.toggle('active', state.chartConfig.active.xLog);
        updateActiveChart();
    });
    elements.toggleActiveLogY.addEventListener('click', () => {
        state.chartConfig.active.yLog = !state.chartConfig.active.yLog;
        elements.toggleActiveLogY.classList.toggle('active', state.chartConfig.active.yLog);
        updateActiveChart();
    });
    elements.activeIncludeLinear.addEventListener('change', () => {
        state.chartConfig.active.includeLinear = elements.activeIncludeLinear.checked;
        updateActiveChart();
    });
    elements.activeIncludePower.addEventListener('change', () => {
        state.chartConfig.active.includePower = elements.activeIncludePower.checked;
        updateActiveChart();
    });


    elements.resetActiveZoomBtn.addEventListener('click', () => {
        if (activeChart) {
            activeChart.resetZoom();
        }
    });

    // --- Initial Load & Polling ---
    initUserConfig();
    loadAndRenderMeasurements();
    updateCurveFormulaPreview(); // Initialize formula preview
    pollLockStatus();
    setInterval(pollLockStatus, 10000); // Poll lock status every 10s
});
