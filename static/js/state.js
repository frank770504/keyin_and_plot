// static/js/state.js

const generateSessionId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const state = {
    allMeasurements: [],
    activeMeasurement: null,
    isEditing: false,
    sortState: { column: 'name', direction: 'asc' },
    measurementFilter: '',
    userName: localStorage.getItem('userName') || null,
    sessionID: sessionStorage.getItem('sessionID') || generateSessionId(),
    isGlobalEditor: false,
    lockOwner: null,
    comparisonSelected: new Set(),
    centerColumnAutoHidden: false,
    editingOriginalName: null,
    heartbeatInterval: null,
    lastValidValues: new WeakMap(), // Track numeric input history
    chartConfig: {
        comparison: {
            xLog: false,
            yLog: false,
            includeLinear: false,
            includePower: true
        },
        active: {
            xLog: false,
            yLog: false,
            includeLinear: false,
            includePower: false
        }
    }
};

// Persist sessionID
sessionStorage.setItem('sessionID', state.sessionID);

export default state;

export function setAllMeasurements(measurements) {
    state.allMeasurements = measurements;
}

export function setEditingOriginalName(name) {
    state.editingOriginalName = name;
}

export function setActiveMeasurement(name) {
    state.activeMeasurement = name;
}

export function setEditing(isEditing) {
    state.isEditing = isEditing;
}

export function setGlobalEditor(isEditor, owner = null) {
    state.isGlobalEditor = isEditor;
    state.lockOwner = owner;
}

export function setUserName(name) {
    state.userName = name;
    if (name) {
        localStorage.setItem('userName', name);
    } else {
        localStorage.removeItem('userName');
    }
}

export function setHeartbeat(intervalId) {
    if (state.heartbeatInterval) clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = intervalId;
}

export function clearHeartbeat() {
    if (state.heartbeatInterval) {
        clearInterval(state.heartbeatInterval);
        state.heartbeatInterval = null;
    }
}

export function setSortState(column, direction) {
    state.sortState = { column, direction };
}

export function setMeasurementFilter(term) {
    state.measurementFilter = term;
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

export function setCenterColumnAutoHidden(isHidden) {
    state.centerColumnAutoHidden = isHidden;
}
