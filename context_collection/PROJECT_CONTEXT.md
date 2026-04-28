# Project Context: Rheology Plotter (Key-in and Plot)

## 1. Overview
An interactive web application for managing, visualizing, and analyzing 2D rheology datasets. It allows users to input experimental data (RPM, Viscosity, Torque), calculates physical properties (Shear Rate, Shear Stress) based on spindle factors, and performs regression analysis.

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
├── api.py              # REST API (Locking, Datasets, Points, Regression)
├── models.py           # SQLAlchemy Models (GlobalLock, Dataset, Point)
├── migrate_v3.py       # Master migration utility (Schema & Constraints)
├── templates/
│   └── index.html      # Single-page application template
└── static/
    ├── style.css       # Main layout and UI styling
    └── js/
        ├── main.js     # Central controller & Lock lifecycle management
        ├── api.js      # Frontend API client (Session-aware fetchers)
        ├── state.js    # Global state (Lock status, User session, Dataset data)
        ├── chart_service.js # Chart.js orchestration
        └── ui/         # Modular UI components (Layout, Tables, Legends)
```

## 4. Key Workflows & Features

### A. Global Editor Lock (Single-Editor Policy)
The application enforces a single-editor workflow to ensure data integrity:
1.  **Implicit Acquisition**: Clicking "Edit", "Create Dataset", or "Delete Dataset" automatically attempts to acquire the `GlobalLock`.
2.  **Exclusivity**: If User A is editing, User B is blocked from all write actions and sees "User A is Editing" in the sidebar.
3.  **Automatic Release**: The lock is released immediately when the editor clicks "Save", "Cancel", or closes/refreshes the browser tab (via `sendBeacon`).
4.  **Heartbeat & Expiry**: A 30s heartbeat keeps the lock alive. If a session is abandoned, the lock expires after 120s of inactivity.

### B. Draft System
Used to prevent direct modification of production records:
1.  **Edit Start**: Clones the `Dataset` and its `Points` into new records with `is_draft=True`.
2.  **Commit**: Merges draft changes back to the original record and deletes the draft.
3.  **Rollback**: Deletes the draft, reverting the view to the production state.

### C. Real-time Data Entry & Sync
- **Editable Table**: Syncs data to the backend as the user types (on `change` events).
- **Auto-Calculation**: Backend calculates Shear Rate and Shear Stress in real-time based on `N` (RPM), `eta` (mPa·s), and the selected `SpindleFactor`.

### D. Analysis & Regression
- **Analysis Window**: Floating scatter plot of the active dataset.
- **Linear Regression**: $\sigma = m \dot{\gamma} + c$
- **Power Law Regression**: $\sigma = a \dot{\gamma}^b$
- **Comparison View**: Overlay multiple datasets on a single chart.

### E. Unified Multi-Pane Layout
The UI features a consistent three-column layout (Dataset List, Workspace, Comparison Chart):
1.  **Independent Gutters**: Vertical gutters separate the columns, acting as drag handles for resizing and housing toggle buttons for collapsing.
2.  **Independent State**: Collapsing one pane (e.g., Dataset List) does not affect the visibility of others.
3.  **Snap-to-Collapse**: A 50px threshold automatically snaps panes to a fully collapsed (0px) state during dragging to prevent layout glitches.
4.  **Width Memory**: Panes remember their last valid width when un-collapsing.
5.  **Fixed-Width Viewport**: The Dataset List table maintains a fixed 450px width; resizing the pane acts as a viewport/clipper for the content.

## 5. Database Schema

### GlobalLock (Singleton)
- `user_name`: Name of the current editor.
- `session_id`: Unique identifier for the browser session.
- `last_heartbeat`: Timestamp for expiry tracking.

### Dataset
- `name`: Unique identifier (string).
- `is_draft`: Boolean flag.
- `original_id`: Reference to original dataset if this is a draft.

### Point
- `N`, `eta`, `torque`, `shear_rate`, `shear_stress`: Physical data.
- `dataset_id`: Foreign key.

## 6. API Endpoints (Summary)
- **Locking**:
    - `GET /api/lock`: Check status (returns `locked`, `user_name`, `is_me`).
    - `POST /api/lock/acquire`: Attempt to take the lock.
    - `POST /api/lock/release`: Relinquish the lock.
    - `POST /api/lock/heartbeat`: Update `last_heartbeat`.
- **Datasets**:
    - `GET /api/datasets`: List all.
    - `GET /api/datasets/<name>`: Get points (prefers draft).
    - `POST /api/datasets/<name>/edit/start`: Initialize edit mode.
    - `POST /api/datasets/<name>/edit/commit`: Save changes.
- **Points**:
    - `POST /api/datasets/<name>/points`: Add data point.
    - `PUT /api/datasets/<name>/points/<id>`: Update point.
