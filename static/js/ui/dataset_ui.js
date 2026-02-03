// static/js/ui/dataset_ui.js
import state, { toggleComparisonSelection } from '../state.js';

export function getProcessedDatasets() {
    const searchTerm = state.datasetFilter.toLowerCase();
    const { column, direction } = state.sortState;

    let filtered = state.allDatasets.filter(d =>
        d.name.toLowerCase().includes(searchTerm) ||
        (d.date && d.date.includes(searchTerm)) ||
        (d.serial_id && d.serial_id.toLowerCase().includes(searchTerm))
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

export function renderDatasetList(elements, onSelect) {
    const datasets = getProcessedDatasets();
    elements.datasetListBody.innerHTML = '';

    datasets.forEach(dataset => {
        const tr = document.createElement('tr');
        // Click on row selects active dataset (middle column)
        tr.addEventListener('click', (e) => {
            // Prevent if clicking on checkbox
            if (e.target.type === 'checkbox') return;
            onSelect(dataset.name);
        });

        // Checkbox for comparison
        const tdCheck = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = state.comparisonSelected.has(dataset.name);
        checkbox.addEventListener('change', () => {
            toggleComparisonSelection(dataset.name);
        });
        tdCheck.appendChild(checkbox);
        tr.appendChild(tdCheck);

        const tdName = document.createElement('td');
        tdName.textContent = dataset.name;
        tr.appendChild(tdName);

        const tdDate = document.createElement('td');
        tdDate.textContent = dataset.date || '';
        tr.appendChild(tdDate);

        const tdSerial = document.createElement('td');
        tdSerial.textContent = dataset.serial_id || '';
        tr.appendChild(tdSerial);

        if (dataset.name === state.activeDataset) {
            tr.classList.add('active');
        }

        elements.datasetListBody.appendChild(tr);
    });
}

export function updateSortIcons(elements) {
    elements.datasetListHeaders.forEach(th => {
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
