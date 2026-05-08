# Project Rules: Rheology Plotter Protocol

## 1. MANDATORY 3-STEP WORKFLOW
Every single user request or identified issue MUST follow this sequence strictly. No exceptions for "minor" or "obvious" fixes.

1.  **Align**: Summarize the request/issue and confirm understanding.
2.  **Plan**: Detail every tool call (read, write, replace, shell) and the intended code changes.
3.  **Wait**: Explicitly ask for "Go ahead" or "Approved".

## 2. STRICT ENFORCEMENT
*   **NO TOOL EXECUTION** (except for initial research reads) is permitted before the "Wait" step is completed and approval is granted.
*   Bypassing the "Wait" step is a failure of the core operational mandate.
*   If a fix fails or needs adjustment, restart the 3-step process for the new approach.

## 3. ZERO SILENCE
*   Always explain the intent before acting, even during the "Plan" phase.

## 4. PROJECT ARCHITECTURE & CONTEXT
- **Backend:** Python 3.11+, Flask, Flask-SQLAlchemy (SQLite).
- **Frontend:** Vanilla JS (ES Modules), HTML5, CSS3. Chart.js for visualization, KaTeX for math rendering.
- **Global Lock (Single-Editor):** The app enforces a single-editor workflow. Actions like "Edit", "Add", or "Delete" acquire a `GlobalLock` to ensure data integrity.
- **Draft-First Workflow:** Creating/editing measurements utilizes an `is_draft=True` system to isolate WIP data from production until explicitly saved/committed.

## 5. AGENT ROUTING: FEATURE SPECIFICATIONS
**MANDATORY INSTRUCTION:** Before modifying code related to any of the features below, you MUST read the corresponding specification file in `docs/specs/` during your "Plan" phase. Do not guess the architecture.

| Domain | When working on... | MUST Read File |
| :--- | :--- | :--- |
| **UI & Layout** | Resizing columns, layout gutters, table rendering (`measurement_ui.js`, `main.js`) | `docs/specs/ui-layout.md` |
| **Search (RQL)** | Filtering, search bar, `query_parser.js` | `docs/specs/feature-search.md` |
| **Charts** | `chart_service.js`, LaTeX rendering, exporting plots, reactive comparison plots | `docs/specs/feature-chart-engine.md` |
| **Measurements** | Creating drafts, saving data, syncing APIs (`api.py`, `state.js`, etc.) | `docs/specs/feature-measurement.md` |
| **Tools** | Backups, CSV Imports | `docs/specs/tooling-backup.md` or `docs/specs/tooling-csv-import.md` |