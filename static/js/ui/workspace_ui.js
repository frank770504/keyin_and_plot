// static/js/ui/workspace_ui.js
import state from '../state.js';

export function renderPointsTable(elements, points, onDelete) {
    elements.pointsTableBody.innerHTML = '';
    points.forEach(point => {
        const tr = createTableRow(point.id, point.x, point.y, onDelete);
        elements.pointsTableBody.appendChild(tr);
    });
    if (state.isEditing) {
        ensureEmptyRow(elements, onDelete);
    }
}

export function createTableRow(id, x, y, onDelete) {
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

    const tdX = document.createElement('td');
    const inputX = document.createElement('input');
    inputX.type = 'number';
    inputX.value = x !== undefined ? x : '';
    inputX.placeholder = 'X';
    inputX.dataset.field = 'x';
    inputX.disabled = !state.isEditing;
    tdX.appendChild(inputX);

    const tdY = document.createElement('td');
    const inputY = document.createElement('input');
    inputY.type = 'number';
    inputY.value = y !== undefined ? y : '';
    inputY.placeholder = 'Y';
    inputY.dataset.field = 'y';
    inputY.disabled = !state.isEditing;
    tdY.appendChild(inputY);

    tr.appendChild(tdAction);
    tr.appendChild(tdX);
    tr.appendChild(tdY);

    return tr;
}

export function ensureEmptyRow(elements, onDelete) {
    const rows = elements.pointsTableBody.querySelectorAll('tr');
    const lastRow = rows[rows.length - 1];

    let needsRow = false;
    if (!lastRow) {
        needsRow = true;
    } else {
        const xInput = lastRow.querySelector('input[data-field="x"]');
        const yInput = lastRow.querySelector('input[data-field="y"]');
        if (xInput && yInput && (xInput.value !== '' || yInput.value !== '')) {
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
