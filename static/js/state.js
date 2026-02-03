// static/js/state.js

const state = {
    allDatasets: [],
    activeDataset: null,
    isEditing: false,
    sortState: { column: 'name', direction: 'asc' },
    datasetFilter: '',
    comparisonSelected: new Set()
};

export default state;

export function setAllDatasets(datasets) {
    state.allDatasets = datasets;
}

export function setActiveDataset(name) {
    state.activeDataset = name;
}

export function setEditing(isEditing) {
    state.isEditing = isEditing;
}

export function setSortState(column, direction) {
    state.sortState = { column, direction };
}

export function setDatasetFilter(term) {
    state.datasetFilter = term;
}

export function toggleComparisonSelection(name) {
    if (state.comparisonSelected.has(name)) {
        state.comparisonSelected.delete(name);
    } else {
        state.comparisonSelected.add(name);
    }
}

export function clearComparisonSelection() {
    state.comparisonSelected.clear();
}
