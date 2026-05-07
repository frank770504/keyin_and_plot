# Technical Specification: Draft-First Measurement Creation Workflow

## 1. Overview
The "Draft-First" workflow streamlines measurement creation by initializing a temporary `is_draft=True` record immediately upon clicking "Create". This allows users to utilize the standard editing interface (Data points, Metadata inputs) for new data without committing to the production database until the "Save" action is triggered.

## 2. Backend Logic (`api.py`)

### A. Initialization (`POST /api/measurements`)
- **Cleanup**: Before creating a new measurement, the system explicitly queries and deletes any existing orphaned drafts (`is_draft=True`) to maintain the single-editor model and prevent database ID inflation.
- **Behavior**: Creates a new `Measurement` record with `is_draft=True` and `original_id=None`.
- **Metadata**: Immediately records the creator's `edit_ip` and `edit_date` (UTC).
- **Naming**: Defaults to "NewMeasurement". If a production measurement with that name exists, it appends a numeric suffix (e.g., "NewMeasurement(1)").
- **Locking**: Requires the `GlobalLock`.

### B. Promotion (`POST /api/measurements/<name>/edit/commit`)
- **New Record Logic**: If `original_id` is `None`, the endpoint "promotes" the draft:
    1. Checks for name collisions with existing production measurements.
    2. Automatically resolves collisions by renaming the draft if necessary.
    3. Flips `is_draft` to `False` for the measurement and all associated `Point` records.
    4. Updates the final `edit_ip` and `edit_date`.
- **Response**: Returns the final production name to the frontend.

### C. Visibility (`GET /api/measurements`)
- **Scoped Filtering**: Returns all production measurements (`is_draft=False`) PLUS any active draft belonging to the current `X-Session-ID`.

## 3. Frontend Implementation

### A. Creation Trigger (`main.js`)
- **Action**: Clicking "Create Measurement" calls the initialization API.
- **Race Condition Prevention**: The "Create Measurement" button is immediately disabled upon click and re-enabled in a `finally` block to prevent multiple concurrent draft creation requests.
- **State Validation**: If `state.isEditing` is already true, creation is blocked and an alert is shown.
- **State Transition**: Immediately sets `state.isEditing = true` and `state.editingOriginalName = null` (signaling a new record).
- **UI Reset & Update**: Clears all workspace inputs (Formula ID, Test Date, Serial ID, Note, and Spindle) to ensure a blank slate. Critically, the `active-measurement-id` field is explicitly set to the `newId` returned by the API.
- **Field Constraints**:
    - **FID/SID**: Spaces and tabs are blocked via `keydown` and stripped via `input` events.
    - **Test Date**: A text input with a `YYYY-MM-DD` placeholder replaces the native date picker.
- **Validation Indicators**: 
    - Mandatory fields (Formula ID, Test Date, Serial ID, Spindle) are marked with an asterisk (`*`) on their labels or placeholders.
    - During editing, empty mandatory fields are dynamically highlighted with a red border and light red background (`.validation-error`).
- **Validation**: Disables the "Save" button (grey/unclickable) until all four mandatory fields are populated.

### B. Persistence & Sync
- **Mandatory Fields**: The "Save" button is dynamically enabled/disabled based on the presence of a Formula ID, a valid Test Date (`YYYY-MM-DD` or `YYYY/MM/DD`), a Serial ID, and a Spindle ID.
- **Pre-Commit Sync**: When "Save" is clicked, the system iterates through all table rows and ensures `syncTableRow()` is completed for each before calling the `commit` API.
- **Real-time Metadata**: Any change to metadata or points triggers an immediate background sync that updates the measurement's `edit_ip` and `edit_date`.
- **Real-time Feedback**: Shear Rate and Shear Stress are calculated on the backend as points are added to the draft and updated in the UI via the `sync` response.

### C. Cancellation (`cancelEditMode`)
- **Discard Policy**: If `editingOriginalName` is `null` (new measurement), the `rollback` API is called, and the workspace is cleared (`setActiveMeasurement(null)`), as there is no production record to revert to.

## 4. UI Indicators
- **List Indicator**: Drafts in the measurement list are appended with a ` (Draft)` suffix and styled with italic/muted text (`.measurement-draft`).
- **Input Removal**: The legacy "New Measurement Name" input field was removed in favor of editing the name directly in the Workspace header during the draft phase.
