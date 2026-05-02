# Technical Specification: Unified Table System

## 1. Overview
The Unified Table System provides a high-density, customizable interface for data management. It decouples table width from pane width, allowing tables to maintain their own dimensions while providing a consistent horizontal scrolling experience.

## 2. Core Features

### A. High-Density Styling
- **Compactness**: Cell padding is reduced (e.g., `4px 6px`) to maximize information density.
- **Overflow Handling**: Both headers (`th`) and data cells (`td`) utilize `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap` to maintain layout integrity in narrow columns.

### B. Independent Viewports
- **Scroll Container**: Tables are wrapped in a `.table-scroll-container` with `overflow-x: auto`.
- **Width Independence**: Tables use `width: max-content`, ensuring they do not stretch or shrink when the surrounding pane is resized via gutters.

## 3. Customization & Persistence

### A. Column Resizing (`TableResizer`)
- **Interaction**: Users can drag invisible 5px-wide handles on the right edge of any header.
- **Constraints**: Minimum width is enforced at **20px**.
- **Layout**: Uses `table-layout: fixed` to ensure column width adjustments are predictable and stable.

### B. Column Reordering (`ColumnReorderer`)
- **Interaction**: Uses the HTML5 Drag and Drop API. Headers are marked with `draggable="true"` and change cursor to `grab/grabbing`.
- **Visual Feedback**:
    - `.dragging-header`: 50% opacity and muted background for the column being moved.
    - `.drop-before` / `.drop-after`: Blue vertical border highlighting the insertion point.
- **ID-Bound Logic**: Rendering and reordering logic is bound to **Column IDs** (`data-col-id` or `data-field`), not array indices.

### C. Layout Persistence
- **Storage**: Layout preferences are saved in `localStorage` using unique keys (e.g., `table-widths-measurements`, `table-column-order-measurements`).
- **Logic**: Widths and orders are stored as ID-to-Value maps. This ensures that a column's width follows it even after it has been moved to a new position.

## 4. Implementation Details
- **Modules**:
    - `static/js/ui/table_resizer.js`: Logic for drag-to-resize handles.
    - `static/js/ui/column_reorderer.js`: Logic for drag-to-reorder headers.
    - `static/js/ui/measurement_ui.js`: Order-aware rendering for the measurement list.
- **CSS**: Located in the "Table Styles" section of `static/style.css`.
