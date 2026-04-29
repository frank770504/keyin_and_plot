// static/js/ui/measurement_ui.js
import state, { toggleComparisonSelection } from '../state.js';

export function getProcessedMeasurements() {
    const searchTerm = state.measurementFilter.toLowerCase();
    const { column, direction } = state.sortState;

    let filtered = state.allMeasurements.filter(m =>
        m.name.toLowerCase().includes(searchTerm) ||
        (m.date && m.date.includes(searchTerm)) ||
        (m.serial_id && m.serial_id.toLowerCase().includes(searchTerm))
    );

    // Sort
    filtered.sort((a, b) => {
        let valA = a[column] || '';
        let valB = b[column] || '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return filtered;
}

export function renderMeasurementList(elements, onSelect) {
    const measurements = getProcessedMeasurements();
    elements.measurementListBody.innerHTML = '';

    measurements.forEach(measurement => {
        const tr = document.createElement('tr');
        // Click on row selects active measurement (middle column)
        tr.addEventListener('click', (e) => {
            // Prevent if clicking on checkbox
            if (e.target.type === 'checkbox') return;
            onSelect(measurement.name);
        });

        // Checkbox for comparison
        const tdCheck = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = state.comparisonSelected.has(measurement.name);
        checkbox.addEventListener('change', () => {
            toggleComparisonSelection(measurement.name);
        });
        tdCheck.appendChild(checkbox);
        tr.appendChild(tdCheck);

        const tdName = document.createElement('td');
        tdName.textContent = measurement.is_draft ? `${measurement.name} (Draft)` : measurement.name;
        tr.appendChild(tdName);

        const tdDate = document.createElement('td');
        tdDate.textContent = measurement.date || '';
        tr.appendChild(tdDate);

        const tdSerial = document.createElement('td');
        tdSerial.textContent = measurement.serial_id || '';
        tr.appendChild(tdSerial);

        if (measurement.name === state.activeMeasurement) {
            tr.classList.add('active');
        }
        if (measurement.is_draft) {
            tr.classList.add('measurement-draft');
        }

        elements.measurementListBody.appendChild(tr);
    });
}

export function updateSortIcons(elements) {
    elements.measurementListHeaders.forEach(th => {
        const column = th.dataset.sort;
        if (!column) return; // Skip non-sortable headers like checkbox

        const iconSpan = th.querySelector('.sort-icon');
        th.classList.remove('sorted-asc', 'sorted-desc');
        iconSpan.textContent = '';

        if (column === state.sortState.column) {
            th.classList.add(state.sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
            iconSpan.textContent = state.sortState.direction === 'asc' ? '▲' : '▼';
        }
    });
}
