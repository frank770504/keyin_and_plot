// static/js/ui/workspace_ui.js
import state from '../state.js';

export function renderPointsTable(elements, points, onDelete) {
    elements.pointsTableBody.innerHTML = '';
    points.forEach(point => {
        const tr = createTableRow(point.id, point.N, point.eta, onDelete, point.torque);
        elements.pointsTableBody.appendChild(tr);
    });
    if (state.isEditing) {
        ensureEmptyRow(elements, onDelete);
    }
}

export function createTableRow(id, N, eta, onDelete, torque) {
    const tr = document.createElement('tr');
    if (id) tr.dataset.id = id;

    const tdAction = document.createElement('td');
    tdAction.className = 'action-column';
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'delete-point-btn';

    deleteBtn.addEventListener('click', () => {
        if (id) {
            onDelete(id);
        } else {
            tr.remove();
        }
    });
    tdAction.appendChild(deleteBtn);

    const tdN = document.createElement('td');
    const inputN = document.createElement('input');
    inputN.type = 'number';
    inputN.value = N !== undefined ? N : '';
    inputN.placeholder = 'N (RPM)';
    inputN.dataset.field = 'N';
    inputN.disabled = !state.isEditing;
    tdN.appendChild(inputN);

    const tdEta = document.createElement('td');
    const inputEta = document.createElement('input');
    inputEta.type = 'number';
    inputEta.value = eta !== undefined ? eta : '';
    inputEta.placeholder = 'η (mPa∙s)';
    inputEta.dataset.field = 'eta';
    inputEta.disabled = !state.isEditing;
    tdEta.appendChild(inputEta);

    const tdTorque = document.createElement('td');
    const inputTorque = document.createElement('input');
    inputTorque.type = 'number';
    inputTorque.value = torque !== undefined && torque !== null ? torque : '';
    inputTorque.placeholder = 'Torque (%)';
    inputTorque.dataset.field = 'torque';
    inputTorque.disabled = !state.isEditing;
    tdTorque.appendChild(inputTorque);

    tr.appendChild(tdAction);
    tr.appendChild(tdN);
    tr.appendChild(tdEta);
    tr.appendChild(tdTorque);

    return tr;
}

export function ensureEmptyRow(elements, onDelete) {
    const rows = elements.pointsTableBody.querySelectorAll('tr');
    const lastRow = rows[rows.length - 1];

    let needsRow = false;
    if (!lastRow) {
        needsRow = true;
    } else {
        const nInput = lastRow.querySelector('input[data-field="N"]');
        const etaInput = lastRow.querySelector('input[data-field="eta"]');
        const torqueInput = lastRow.querySelector('input[data-field="torque"]');
        if (nInput && etaInput && (nInput.value !== '' || etaInput.value !== '' || (torqueInput && torqueInput.value !== ''))) {
            needsRow = true;
        }
    }

    if (needsRow) {
        const tr = createTableRow(null, undefined, undefined, onDelete);
        elements.pointsTableBody.appendChild(tr);
    }
}

export function updateEditModeUI(elements) {
    const isEditing = state.isEditing;
    const centerColumn = document.getElementById('center-column'); // Or pass in elements.centerColumn

    if (isEditing) {
        centerColumn.classList.remove('read-only-mode');
        elements.editToggleBtn.textContent = 'Done Editing';
        elements.editToggleBtn.classList.add('editing');

        elements.activeDatasetName.style.display = 'none';
        elements.activeDatasetNameInput.style.display = 'block';
        elements.activeDatasetNameInput.value = state.activeDataset;

        elements.deleteDatasetBtn.style.display = 'inline-block';
    } else {
        centerColumn.classList.add('read-only-mode');
        elements.editToggleBtn.textContent = 'Edit';
        elements.editToggleBtn.classList.remove('editing');

        elements.activeDatasetName.style.display = 'block';
        elements.activeDatasetNameInput.style.display = 'none';

        elements.deleteDatasetBtn.style.display = 'none';
    }

    elements.datasetDateInput.disabled = !isEditing;
    elements.datasetSerialIdInput.disabled = !isEditing;
    elements.datasetSpindleSelect.disabled = !isEditing;

    const tableInputs = elements.pointsTableBody.querySelectorAll('input');
    tableInputs.forEach(input => input.disabled = !isEditing);
}

export function toggleCenterColumn(elements, show, resizeChartsCallback) {
    const displayValue = show ? 'flex' : 'none';
    const gutterDisplay = show ? 'block' : 'none';
    const centerColumn = document.getElementById('center-column');

    if (centerColumn.style.display !== displayValue) {
        centerColumn.style.display = displayValue;
        elements.dragHandle.style.display = gutterDisplay;
        elements.editToggleBtn.style.display = show ? 'block' : 'none';

        setTimeout(() => {
            if (resizeChartsCallback) resizeChartsCallback();
        }, 0);
    }
}
