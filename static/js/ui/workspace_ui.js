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
            const tr = createTableRow(point.id, point.N, point.eta, onDelete, point.torque, point.shear_rate, point.shear_stress);
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
    const displays = {
        shear_rate: tr.querySelector('[data-field="shear_rate"]'),
        shear_stress: tr.querySelector('[data-field="shear_stress"]')
    };

    if (inputs.N && inputs.N.value != (N || '')) inputs.N.value = N || '';
    if (inputs.eta && inputs.eta.value != (eta || '')) inputs.eta.value = eta || '';
    if (inputs.torque && inputs.torque.value != (torque !== null ? torque : '')) inputs.torque.value = torque !== null ? torque : '';

    if (displays.shear_rate) displays.shear_rate.textContent = fmt(shearRate);
    if (displays.shear_stress) displays.shear_stress.textContent = fmt(shearStress);
}

export function createTableRow(id, N, eta, onDelete, torque, shearRate, shearStress) {
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
    deleteBtn.addEventListener('click', () => {
        if (id) {
            onDelete(id);
        } else {
            tr.remove();
        }
    });

    return tr;
}

export function ensureEmptyRow(elements, onDelete) {
    const rows = Array.from(elements.pointsTableBody.querySelectorAll('tr'));

    // Helper to check if a row is "empty" (no ID and no input values)
    const isRowEmpty = (tr) => {
        if (tr.dataset.id) return false;
        const inputs = tr.querySelectorAll('input');
        return Array.from(inputs).every(input => input.value === '');
    };

    const emptyRows = rows.filter(isRowEmpty);
    const lastRow = rows[rows.length - 1];

    // 1. If there's no empty row at the very bottom, add one
    if (!lastRow || !isRowEmpty(lastRow)) {
        const tr = createTableRow(null, undefined, undefined, onDelete, undefined, undefined, undefined);
        elements.pointsTableBody.appendChild(tr);
    }
    // 2. If there are multiple empty rows, remove the extras
    else if (emptyRows.length > 1) {
        // Keep only the last one
        emptyRows.forEach((tr, index) => {
            if (index < emptyRows.length - 1) {
                tr.remove();
            }
        });
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
