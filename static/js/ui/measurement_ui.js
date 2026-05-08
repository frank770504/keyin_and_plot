// static/js/ui/measurement_ui.js
import state, { toggleComparisonSelection } from '../state.js';
import { parseQuery } from '../query_parser.js';

export function getProcessedMeasurements() {
    const { column, direction } = state.sortState;

    const predicate = parseQuery(state.measurementFilter, state.comparisonSelected);
    let filtered = state.allMeasurements.filter(predicate);

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

export function renderMeasurementList(elements, onSelect, onComparisonToggle) {
    const measurements = getProcessedMeasurements();
    const table = elements.measurementListTable;
    const thead = table.querySelector('thead');
    const tbody = elements.measurementListBody;

    // 1. Determine Column Order
    const defaultOrder = ['plot', 'pkey', 'formula_id', 'date', 'serial_id'];
    const savedOrder = localStorage.getItem('table-column-order-measurements');
    const columnOrder = savedOrder ? JSON.parse(savedOrder) : defaultOrder;

    // 2. Render Headers (if not already rendered with resizers/drag handles)
    // Note: We only re-render headers if the order has changed or it's the first run.
    // For simplicity and to maintain resizer handles, we'll assume ColumnReorderer handles header DOM moves.
    // Here we focus on rendering the BODY rows according to the current header order.
    const currentHeaders = Array.from(thead.querySelectorAll('th'));

    // Ensure all headers have the required structure for Option 1
    currentHeaders.forEach(th => {
        if (th.classList.contains('checkbox-column')) return;

        let content = th.querySelector('.header-content');
        if (!content) {
            content = document.createElement('div');
            content.classList.add('header-content');
            while (th.firstChild) content.appendChild(th.firstChild);
            th.appendChild(content);
        }

        // Identify sortable columns and wrap text in sort-label
        if (th.dataset.sort) {
            // Find text nodes or elements that aren't icons/handles
            const children = Array.from(content.childNodes);
            let labelSpan = content.querySelector('.sort-label');

            if (!labelSpan) {
                labelSpan = document.createElement('span');
                labelSpan.classList.add('sort-label');

                // Move text nodes and specific spans into labelSpan
                children.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('drag-handle') && !node.classList.contains('sort-icon'))) {
                        labelSpan.appendChild(node);
                    }
                });

                const icon = content.querySelector('.sort-icon');
                if (icon) {
                    content.insertBefore(labelSpan, icon);
                } else {
                    content.appendChild(labelSpan);
                }
            }
        }
    });

    const currentOrder = currentHeaders.map(th => th.dataset.colId || (th.classList.contains('checkbox-column') ? 'plot' : ''));

    tbody.innerHTML = '';

    measurements.forEach(measurement => {
        const tr = document.createElement('tr');
        tr.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            onSelect(measurement.pkey);
        });

        currentOrder.forEach(colId => {
            const td = document.createElement('td');
            switch (colId) {
                case 'plot':
                    td.classList.add('checkbox-column');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = state.comparisonSelected.has(measurement.pkey);
                    checkbox.addEventListener('change', () => {
                        toggleComparisonSelection(measurement.pkey);
                        if (onComparisonToggle) onComparisonToggle();
                        updateMasterCheckbox(measurements);
                    });
                    td.appendChild(checkbox);
                    td.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (e.target !== checkbox) checkbox.click();
                    });
                    break;
                case 'pkey':
                case 'id':
                    td.textContent = measurement.original_id || measurement.pkey;
                    break;
                case 'formula_id':
                case 'liquid_name':
                    td.textContent = measurement.is_draft ? `${measurement.formula_id} (Draft)` : measurement.formula_id;
                    break;
                case 'date':
                    td.textContent = measurement.date || '';
                    break;
                case 'serial_id':
                    td.textContent = measurement.serial_id || '';
                    break;
            }
            tr.appendChild(td);
        });

        if (measurement.pkey === state.activeMeasurement) tr.classList.add('active');
        if (measurement.is_draft) tr.classList.add('measurement-draft');

        tbody.appendChild(tr);
    });

    updateMasterCheckbox(measurements);
}

export function updateMasterCheckbox(visibleMeasurements) {
    const masterCheckbox = document.getElementById('master-plot-checkbox');
    if (!masterCheckbox) return;

    if (visibleMeasurements.length === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
        return;
    }

    const selectedVisible = visibleMeasurements.filter(m => state.comparisonSelected.has(m.pkey));

    if (selectedVisible.length === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    } else if (selectedVisible.length === visibleMeasurements.length) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
    }
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
