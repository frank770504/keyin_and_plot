// static/js/state.js

const generateSessionId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const state = {
    allMeasurements: [],
    activeMeasurement: null, // Now stores ID
    isEditing: false,
    sortState: { column: 'formula_id', direction: 'asc' },
    measurementFilter: '',
    userName: localStorage.getItem('userName') || null,
    sessionID: sessionStorage.getItem('sessionID') || generateSessionId(),
    isGlobalEditor: false,
    lockOwner: null,
    comparisonSelected: new Set(), // Now stores IDs
    centerColumnAutoHidden: false,
    editingOriginalId: null, // Renamed from editingOriginalName, now stores ID
    isDirty: false,
    heartbeatInterval: null,
    lastValidValues: new WeakMap(), // Track numeric input history
    chartConfig: {
        comparison: {
            xLog: false,
            yLog: false,
            includeLinear: false,
            includePower: true,
            xMin: null,
            xMax: null,
            yMin: null,
            yMax: null,
            customCurves: [] // Array of { id, type, param1, param2, color }
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

export function setEditingOriginalId(id) {
    state.editingOriginalId = id;
}

export function setActiveMeasurement(id) {
    state.activeMeasurement = id;
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

export function toggleComparisonSelection(id) {
    if (state.comparisonSelected.has(id)) {
        state.comparisonSelected.delete(id);
    } else {
        state.comparisonSelected.add(id);
    }
}

export function clearComparisonSelection() {
    state.comparisonSelected.clear();
}

export function setCenterColumnAutoHidden(isHidden) {
    state.centerColumnAutoHidden = isHidden;
}

export function setDirty(isDirty) {
    state.isDirty = isDirty;
}
