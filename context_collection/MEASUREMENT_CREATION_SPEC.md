# Technical Specification: Draft-First Measurement Creation Workflow

## 1. Overview
The "Draft-First" workflow streamlines measurement creation by initializing a temporary `is_draft=True` record immediately upon clicking "Create". This allows users to utilize the standard editing interface (Editable Table, Metadata inputs) for new data without committing to the production database until the "Save" action is triggered.

## 2. Backend Logic (`api.py`)

### A. Initialization (`POST /api/measurements`)
- **Behavior**: Creates a new `Measurement` record with `is_draft=True` and `original_id=None`.
- **Naming**: Defaults to "New Measurement". If a production measurement with that name exists, it appends a numeric suffix (e.g., "New Measurement (1)").
- **Locking**: Requires the `GlobalLock`.

### B. Promotion (`POST /api/measurements/<name>/edit/commit`)
- **New Record Logic**: If `original_id` is `None`, the endpoint "promotes" the draft:
    1. Checks for name collisions with existing production measurements.
    2. Automatically resolves collisions by renaming the draft if necessary.
    3. Flips `is_draft` to `False` for the measurement and all associated `Point` records.
- **Response**: Returns the final production name to the frontend.

### C. Visibility (`GET /api/measurements`)
- **Scoped Filtering**: Returns all production measurements (`is_draft=False`) PLUS any active draft belonging to the current `X-Session-ID`.

## 3. Frontend Implementation

### A. Creation Trigger (`main.js`)
- **Action**: Clicking "Create Measurement" (now located at the top of the Measurement column) calls the initialization API.
- **State Transition**: Immediately sets `state.isEditing = true` and `state.editingOriginalName = null` (signaling a new record).
- **UI Update**: Focuses the workspace and allows immediate metadata/point entry.

### B. Persistence & Sync
- **Pre-Commit Sync**: When "Save" is clicked, the system iterates through all table rows and ensures `syncTableRow()` is completed for each before calling the `commit` API.
- **Real-time Feedback**: Shear Rate and Shear Stress are calculated on the backend as points are added to the draft and updated in the UI via the `sync` response.

### C. Cancellation (`cancelEditMode`)
- **Discard Policy**: If `editingOriginalName` is `null` (new measurement), the `rollback` API is called, and the workspace is cleared (`setActiveMeasurement(null)`), as there is no production record to revert to.

## 4. UI Indicators
- **List Indicator**: Drafts in the measurement list are appended with a ` (Draft)` suffix and styled with italic/muted text (`.measurement-draft`).
- **Input Removal**: The legacy "New Measurement Name" input field was removed in favor of editing the name directly in the Workspace header during the draft phase.
