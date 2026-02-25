// static/js/ui/workspace_ui.js
import state from '../state.js';

export function renderPointsTable(elements, points, onDelete) {
    elements.pointsTableBody.innerHTML = '';
    points.forEach(point => {
        const tr = createTableRow(point.id, point.N, point.eta, onDelete, point.torque, point.shear_rate, point.shear_stress);
        elements.pointsTableBody.appendChild(tr);
    });
    if (state.isEditing) {
        ensureEmptyRow(elements, onDelete);
    }

    if (typeof renderMathInElement === 'function') {
        renderMathInElement(elements.pointsTableBody.parentElement, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
}

export function createTableRow(id, N, eta, onDelete, torque, shearRate, shearStress) {
    const tr = document.createElement('tr');
    if (id) tr.dataset.id = id;

    // Formatting helper
    const fmt = (val) => (val !== undefined && val !== null) ? parseFloat(val).toFixed(3) : '';

    tr.innerHTML = `
        <td class="action-column">
            <button class="delete-point-btn">×</button>
        </td>
        <td>
            <input type="number" data-field="N" value="${N !== undefined ? N : ''}"
                   placeholder="$N$ (RPM)" ${!state.isEditing ? 'disabled' : ''}>
        </td>
        <td>
            <input type="number" data-field="eta" value="${eta !== undefined ? eta : ''}"
                   placeholder="$\\eta$ (mPa$\\cdot$s)" ${!state.isEditing ? 'disabled' : ''}>
        </td>
        <td>
            <input type="number" data-field="torque" value="${torque !== undefined && torque !== null ? torque : ''}" 
                   placeholder="Torque (%)" ${!state.isEditing ? 'disabled' : ''}>
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
        const tr = createTableRow(null, undefined, undefined, onDelete, undefined, undefined, undefined);
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
