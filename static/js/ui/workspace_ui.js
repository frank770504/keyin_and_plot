// static/js/ui/workspace_ui.js
import state from '../state.js';

export function renderPointsTable(elements, points, onDelete) {
    const tbody = elements.pointsTableBody;
    const existingRows = new Map();
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
        existingRows.set(tr.dataset.id, tr);
    });

    const newRows = [];
    points.forEach(point => {
        const idStr = point.id.toString();
        if (existingRows.has(idStr)) {
            const tr = existingRows.get(idStr);
            updateTableRow(tr, point.N, point.eta, point.torque, point.shear_rate, point.shear_stress);
            newRows.push(tr);
            existingRows.delete(idStr);
        } else {
            const tr = createTableRow(point.id, point.N, point.eta, onDelete, point.torque, point.shear_rate, point.shear_stress, () => ensureEmptyRow(elements, onDelete));
            newRows.push(tr);
        }
    });

    // Clear and re-append in correct order (more efficient than manual diffing)
    tbody.innerHTML = '';
    newRows.forEach(tr => tbody.appendChild(tr));

    if (state.isEditing) {
        ensureEmptyRow(elements, onDelete);
    }

    if (typeof renderMathInElement === 'function') {
        renderMathInElement(tbody.parentElement, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
}

export function updateTableRow(tr, N, eta, torque, shearRate, shearStress) {
    // Only update if not currently syncing (user is typing)
    if (tr.classList.contains('syncing')) return;

    const fmt = (val) => (val !== undefined && val !== null) ? parseFloat(val).toFixed(3) : '';

    const inputs = {
        N: tr.querySelector('input[data-field="N"]'),
        eta: tr.querySelector('input[data-field="eta"]'),
        torque: tr.querySelector('input[data-field="torque"]')
    };

    if (inputs.N) {
        if (inputs.N.value != (N || '')) inputs.N.value = N || '';
        state.lastValidValues.set(inputs.N, inputs.N.value);
    }
    if (inputs.eta) {
        if (inputs.eta.value != (eta || '')) inputs.eta.value = eta || '';
        state.lastValidValues.set(inputs.eta, inputs.eta.value);
    }
    if (inputs.torque) {
        const torqueVal = (torque !== null && torque !== undefined) ? torque : '';
        if (inputs.torque.value != torqueVal) inputs.torque.value = torqueVal;
        state.lastValidValues.set(inputs.torque, inputs.torque.value);
    }
}

export function createTableRow(id, N, eta, onDelete, torque, shearRate, shearStress, onRemove) {
    const tr = document.createElement('tr');
    if (id) tr.dataset.id = id;

    // Formatting helper
    const fmt = (val) => (val !== undefined && val !== null) ? parseFloat(val).toFixed(3) : '';

    // Note: We use Unicode for placeholders because KaTeX cannot render inside attribute values.
    tr.innerHTML = String.raw`
        <td class="action-column">
            <button class="delete-point-btn">×</button>
        </td>
        <td>
            <input type="text" data-field="N" value="${N !== undefined ? N : ''}"
                   placeholder="N (RPM)" inputmode="decimal" ${!state.isEditing ? 'disabled' : ''}>
        </td>
        <td>
            <input type="text" data-field="eta" value="${eta !== undefined ? eta : ''}"
                   placeholder="η (mPa·s)" inputmode="decimal" ${!state.isEditing ? 'disabled' : ''}>
        </td>
        <td>
            <input type="text" data-field="torque" value="${torque !== undefined && torque !== null ? torque : ''}"
                   placeholder="Torque (%)" inputmode="decimal" ${!state.isEditing ? 'disabled' : ''}>
        </td>
        <td>
            <span class="calculated-value" data-field="shear_rate">${fmt(shearRate)}</span>
        </td>
        <td>
            <span class="calculated-value" data-field="shear_stress">${fmt(shearStress)}</span>
        </td>
    `;

    // Event Listeners
    const deleteBtn = tr.querySelector('.delete-point-btn');

    // Initialize numeric history tracking
    tr.querySelectorAll('input').forEach(input => {
        state.lastValidValues.set(input, input.value);
    });

    deleteBtn.addEventListener('click', () => {
        if (id) {
            onDelete(id);
        } else {
            tr.remove();
            if (onRemove) onRemove();
        }
    });

    return tr;
}

export function ensureEmptyRow(elements, onDelete) {
    const rows = Array.from(elements.pointsTableBody.querySelectorAll('tr'));

    const isRowTrulyEmpty = (tr) => {
        if (tr.dataset.id) return false;
        const inputs = tr.querySelectorAll('input');
        return Array.from(inputs).every(input => input.value === '');
    };

    const isRowComplete = (tr) => {
        const n = tr.querySelector('input[data-field="N"]')?.value;
        const eta = tr.querySelector('input[data-field="eta"]')?.value;
        const torque = tr.querySelector('input[data-field="torque"]')?.value;
        return n !== '' && eta !== '' && torque !== '';
    };

    const lastRow = rows[rows.length - 1];

    // 1. If last row is complete (or no rows at all), pop up a new truly empty row
    if (!lastRow || isRowComplete(lastRow)) {
        const tr = createTableRow(null, undefined, undefined, onDelete, undefined, undefined, undefined, () => ensureEmptyRow(elements, onDelete));
        elements.pointsTableBody.appendChild(tr);
    }

    // 2. Secondary cleanup: Ensure only ONE truly empty row exists, and it must be at the very end
    const allRowsUpdated = Array.from(elements.pointsTableBody.querySelectorAll('tr'));
    const trulyEmptyRows = allRowsUpdated.filter(isRowTrulyEmpty);
    if (trulyEmptyRows.length > 1) {
        trulyEmptyRows.forEach((tr, index) => {
            const isLastInTable = tr === allRowsUpdated[allRowsUpdated.length - 1];
            if (!isLastInTable || index < trulyEmptyRows.length - 1) {
                tr.remove();
            }
        });
    }
}

export function updateEditModeUI(elements) {
    const isEditing = state.isEditing;
    const centerColumn = document.getElementById('center-column');

    if (isEditing) {
        centerColumn.classList.remove('read-only-mode');
        elements.editBtn.classList.add('editing');

        elements.activeDatasetName.style.display = 'none';
        elements.activeDatasetNameInput.style.display = 'block';
        elements.activeDatasetNameInput.value = state.activeDataset;

        elements.deleteDatasetBtn.style.display = 'inline-block';
    } else {
        centerColumn.classList.add('read-only-mode');
        elements.editBtn.classList.remove('editing');

        elements.activeDatasetName.style.display = 'block';
        elements.activeDatasetNameInput.style.display = 'none';

        elements.deleteDatasetBtn.style.display = 'none';
        elements.cancelEditBtn.style.display = 'none';
    }

    elements.datasetDateInput.disabled = !isEditing;
    elements.datasetSerialIdInput.disabled = !isEditing;
    elements.datasetSpindleSelect.disabled = !isEditing;

    const tableInputs = elements.pointsTableBody.querySelectorAll('input');
    tableInputs.forEach(input => {
        input.disabled = !isEditing;
    });
}

export function toggleCenterColumn(elements, show, resizeChartsCallback) {
    const displayValue = show ? 'flex' : 'none';
    const gutterDisplay = show ? 'block' : 'none';
    const centerColumn = document.getElementById('center-column');

    if (centerColumn.style.display !== displayValue) {
        centerColumn.style.display = displayValue;
        elements.dragHandle.style.display = gutterDisplay;
        elements.editBtn.style.display = show ? 'block' : 'none';

        setTimeout(() => {
            if (resizeChartsCallback) resizeChartsCallback();
        }, 0);
    }
}
