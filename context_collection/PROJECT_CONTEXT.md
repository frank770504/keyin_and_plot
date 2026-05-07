# Project Context: Rheology Plotter (Key-in and Plot)

## 1. Overview
An interactive web application for managing, visualizing, and analyzing 2D rheology measurements. It allows users to input experimental data (RPM, Viscosity, Torque), calculates physical properties (Shear Rate, Shear Stress) based on spindle factors, and performs regression analysis.

## 2. Technical Stack
- **Backend:** Python 3.11+, Flask, Flask-SQLAlchemy (SQLite)
- **Math/Analysis:** NumPy, Scikit-learn (Linear & Power Law regression)
- **Frontend:** Vanilla JS (ES Modules), HTML5, CSS3
- **Visualization:** Chart.js (with Zoom & Hammer.js plugins)
- **Typography/Math:** KaTeX (LaTeX rendering in UI)
- **Environment:** Managed by `uv`

## 3. Project Structure
```text
keyin-and-plot/
├── app.py              # Main Flask entry point & DB initialization
├── api.py              # REST API (Locking, Measurements, Points, Regression)
├── models.py           # SQLAlchemy Models (GlobalLock, Measurement, Point)
├── migrate_v3.py       # Master migration utility (Schema & Constraints)
├── templates/
│   └── index.html      # Single-page application template
└── static/
    ├── style.css       # Main layout and UI styling
    └── js/
        ├── main.js     # Central controller & Lock lifecycle management
        ├── api.js      # Frontend API client (Session-aware fetchers)
        ├── state.js    # Global state (Lock status, User session, Measurement data)
        ├── chart_service.js # Chart.js orchestration
        └── ui/         # Modular UI components (Layout, Tables, Legends)
```

## 4. Key Workflows & Features

### A. Global Editor Lock (Single-Editor Policy)
The application enforces a single-editor workflow to ensure data integrity:
1.  **Implicit Acquisition**: Clicking "Edit", "Add Measurement", or "Delete Measurement" automatically attempts to acquire the `GlobalLock`.
2.  **Exclusivity**: If User A is editing, User B is blocked from all write actions and sees "User A is Editing" in the sidebar.
3.  **Automatic Release**: The lock is released immediately when the editor clicks "Save", "Cancel", or closes/refreshes the browser tab (via `sendBeacon`).
4.  **Heartbeat & Expiry**: A 30s heartbeat keeps the lock alive. If a session is abandoned, the lock expires after 120s of inactivity.

### B. Draft System
Used to prevent direct modification of production records and streamline creation:
1.  **Edit Start**: Clones an existing `Measurement` into a new record with `is_draft=True`. To maintain the single-editor model, any pre-existing orphaned drafts for other measurements are deleted first. The draft is initialized with the current editor's IP and UTC timestamp.
2.  **Creation**: Clicking "Add Measurement" initializes a brand new draft (`is_draft=True`, `original_id=None`). To prevent ID inflation and enforce the single-editor model, all existing orphaned drafts are explicitly purged from the database before the new draft is created. The workspace inputs (Formula ID, Test Date, SID, Note, Spindle) are cleared, the UI ID is explicitly set to the new database Pkey, and the "Save" button is disabled until all mandatory fields are filled. The default Formula ID is "NewMeasurement" to ensure a whitespace-free start.
3.  **Visual Validation**: Mandatory fields are marked with an asterisk (`*`). During edit mode, empty mandatory fields are highlighted with a red border (`.validation-error`) to provide immediate feedback.
4.  **Field Constraints**:
    *   **Formula ID (FID)** and **Serial ID (SID)**: Spaces and tabs are strictly forbidden. The UI blocks these keys and sanitizes pasted content; the backend strips all whitespace before saving.
    *   **Test Date**: Uses a text input supporting both `YYYY-MM-DD` and `YYYY/MM/DD` formats.
5.  **Commit**: Merges draft changes back to the original or "promotes" a new draft to production by flipping the `is_draft` flag. This also records the final commit IP and timestamp.
6.  **Rollback**: Deletes the draft.

### C. Real-time Data Entry & Sync
- **Data points**: Syncs data to the backend as the user types (on `change` events).
- **Edit Tracking**: Any modification to data points or metadata immediately updates the measurement's `edit_ip` and `edit_date` (UTC).
- **Batch Sync**: On "Save", the frontend ensures all rows are synced before the final commit.
- **Auto-Calculation**: Backend calculates Shear Rate and Shear Stress in real-time based on `N` (RPM), `eta` (mPa·s), and the selected `SpindleFactor`.

### D. Analysis & Regression (Unified Reactive Engine)
- **Unified Controls**: Both the Measurement Plots and the Analysis Window feature identical reactive controls for scale and analysis.
- **Logarithmic Scaling**: Independent X-axis and Y-axis toggles between linear and logarithmic scales.
- **Reactive Regressions**: Support for overlaying Linear ($\sigma = m \dot{\gamma} + c$) and Power Law ($\sigma = a \dot{\gamma}^b$) regressions via persistent checkboxes.
- **Measurement Plots View**: Reactive overlay of multiple measurements based on the "Plot" column.
- **Performance**: Integrated client-side caching ensures near-instant re-renders when toggling visibility or regression modes.
- **Enhanced Interaction**: Optimized hover detection with expanded hit zones ensures reliable tooltips for regression lines regardless of zoom level or aspect ratio.
- **Visual Polish**: Dynamic color generation using the **Golden Ratio in HSV space** ensures an unlimited number of visually distinct colors; unique point styles per measurement; persistent "Reset View" (⟲) button for auto-scaling.

### E. Unified Multi-Pane Layout
The UI features a consistent three-column layout (Measurement List, Workspace, Measurement Plots):
1.  **Measurement List**: Houses the "Add Measurement" button and an **Advanced Search (RQL)** bar. Supports user-adjustable column widths and drag-and-drop reordering. Terminology aligns with database fields: **Pkey**, **FID** (Formula ID), **SID** (Serial ID).
2.  **Independent Gutters**: Vertical gutters separate the columns, acting as drag handles for resizing and housing toggle buttons for collapsing.
3.  **Snap-to-Collapse**: A 50px threshold automatically snaps panes to a fully collapsed (0px) state during dragging.
4.  **Width Memory**: Panes remember their last valid width when un-collapsing.
5.  **Independent Table Viewports**: Tables use `width: max-content` and are wrapped in scrollable containers. Moving gutters clips or reveals the tables without stretching or shrinking them.
6.  **Customizable Columns**: Users can resize columns (min 20px) and reorder them by dragging headers. These layout preferences are bound to Column IDs and persist in `localStorage`.

## 5. Database Schema

### GlobalLock (Singleton)
- `user_name`: Name of the current editor.
- `session_id`: Unique identifier for the browser session.
- `last_heartbeat`: Timestamp for expiry tracking.

### Measurement
- `pkey`: Unique identifier (Integer, primary key).
- `formula_id`: Formula ID / FID (string).
- `date`: Test Date.
- `serial_id`: SID (string).
- `experiment_note`: Note (text).
- `spindle_id`: Selected spindle.
- `is_draft`: Boolean flag.
- `original_id`: Reference to original measurement pkey if this is a draft.
- `edit_ip`: IP address of the last editor.
- `edit_date`: Timestamp of the last edit.

### Point
- `N`, `eta`, `torque`, `shear_rate`, `shear_stress`: Physical data.
- `measurement_pkey`: Foreign key to `measurements.pkey`.

## 6. API Endpoints (Summary)
- **Locking**:
    - `GET /api/lock`: Check status (returns `locked`, `user_name`, `is_me`).
    - `POST /api/lock/acquire`: Attempt to take the lock.
    - `POST /api/lock/release`: Relinquish the lock.
    - `POST /api/lock/heartbeat`: Update `last_heartbeat`.
- **Measurements**:
    - `GET /api/measurements`: List production measurements + user's active draft.
    - `GET /api/measurements/<name>`: Get points (prefers draft).
    - `POST /api/measurements`: Initialize a new draft measurement.
    - `POST /api/measurements/<name>/edit/start`: Initialize edit mode for existing.
    - `POST /api/measurements/<name>/edit/commit`: Save changes (promotes or merges).
- **Points**:
    - `POST /api/measurements/<name>/points`: Add data point.
    - `PUT /api/measurements/<name>/points/<id>`: Update point.
