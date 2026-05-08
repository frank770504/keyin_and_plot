# Technical Specification: Component Standards & Typography

## 1. Typography
- **Base Font Size:** 14px (`0.875rem`) for standard text and data tables.
- **Headers:** H1 is 20px (`1.25rem`, bold), H2 is 18px (`1.125rem`, semibold/bold).
- **Small Text:** 12px (`0.75rem`) for hints and small buttons.

## 2. Interactive Elements
- **Buttons:** 
    - Standard: `padding: 6px 12px`, `font-size: 14px`, `border-radius: 4px`.
    - Small/Icon: `padding: 2px 8px`, `font-size: 12px` (used in toolbars and tables).
- **Input Boxes & Selects:**
    - Standard: `padding: 6px 8px`, `border: 1px solid #ccc`, `border-radius: 4px`.
    - Focus state: `outline: none`, `border-color: #007bff`, `box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25)`.
    - This ensures inputs and buttons are roughly the same height (approx 32px depending on line-height).

---

# Technical Specification: Unified Gutter Resizing & Collapse System

## 1. Architectural Overview
The system implements a multi-pane layout (Left, Center, Right) where the **Left** and **Center** columns are independently resizable and collapsible via dedicated **Gutter** components. The **Right** column is a flexible buffer that occupies all remaining horizontal space using `flex-grow: 1`.

## 2. Component Structure
- **Resizable Column**: A container with `flex-grow: 0` and `flex-shrink: 0`. Its width is managed via explicit pixel values in the DOM style attribute.
- **Gutter**: A vertical handle (e.g., 10px wide) placed immediately after the resizable column. It acts as the hit area for resizing.
- **Collapse Button**: A toggle button embedded inside the Gutter.

## 3. Core Behaviors & Logic

### A. Viewport-Relative Resizing
- **Calculation**: Column width must be calculated relative to the column's own left bounding edge (`e.clientX - columnRect.left`) to ensure mathematical robustness regardless of global layout offsets.
- **Constraints**:
    - **Minimum Width**: 0px.
    - **Maximum Width**: Container width (to prevent columns from expanding beyond the screen).

### B. Snap-to-Collapse (The 50px Threshold)
- **Threshold**: 50 pixels.
- **Collapsing**: If a user drags a column to a width `< 50px`, the system must force the width to `0px` and apply a `.collapsed` CSS class.
- **Expanding (Pull-to-Open)**: If a user drags the gutter of a `.collapsed` column, the column remains at `0px` until the mouse offset exceeds `50px`, at which point it snaps open and follows the cursor.

### C. State Persistence (Width Memory)
- The system must maintain a `lastValidWidth` property.
- **Memory Update**: `lastValidWidth` is updated only when the column width is `> 50px`.
- **Restoration**: When the collapse button is clicked to expand a pane, the system restores the `lastValidWidth`.
- **Safety Fallback**: If `lastValidWidth` is null or below the threshold at initialization, expansion defaults to a sensible value (e.g., 250px).

### D. Event Conflict Resolution
- **Problem**: Mouse events on the Collapse Button (child) bubble up to the Gutter (parent), triggering a "Drag Start" signal that interferes with the "Toggle" signal.
- **Solution**: The Collapse Button must implement `mousedown` and `click` listeners that call `event.stopPropagation()`. This prevents the drag logic from stripping the `.collapsed` state before the toggle logic can evaluate it.

## 4. Visual & CSS Requirements
- **Collapsed State**:
    - `width: 0 !important`.
    - `overflow: hidden`.
    - Content wrapper `opacity: 0` and `pointer-events: none` to prevent layout jumps or phantom clicks.
- **Gutter Styling**: 
    - `cursor: col-resize`.
    - Visual feedback (color change) on `:hover` and during `.dragging`.
- **Transitions**: Smooth CSS transitions for `width` and `opacity` (approx. 300ms).

## 5. API & Modularization
- **Generic Implementation**: The logic must be encapsulated in a class or module that accepts DOM elements as arguments rather than hardcoded string IDs.
- **Programmatic Control**: The initialization must return controller instances that expose a `toggleCollapse()` method, allowing external modules to trigger the UI state programmatically.

---

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