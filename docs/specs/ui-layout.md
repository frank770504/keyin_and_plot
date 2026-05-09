# Technical Specification: Component Standards & Typography

## 1. Typography & Hierarchy
- **Base Font Size:** 14px (`0.875rem`) for standard text and data tables.
- **Headers:** H1 is 28px (`1.75rem`, bold), H2 is 24px (`1.5rem`, semibold/bold).
- **Small Text:** 14px (`0.875rem`) for hints and small buttons.
- **Conventions:** Standard action buttons use clear text combined with standard icons where appropriate (e.g., `✎ Edit`, `💾 Save`).

## 2. Interactive Elements & Sizing

### A. Element Height Parity
To guarantee perfect horizontal alignment in toolbars and rows, all interactive elements (buttons, inputs, selects) are constrained by explicit CSS variables utilizing `box-sizing: border-box`:
- **Standard Height (`--element-standard-height`):** `34px`. Used globally for main form inputs and primary/secondary buttons.
- **Small Height (`--element-small-height`):** `26px`. Used in dense control bars (e.g., chart controls, floating windows) for `.btn-small` and `.limit-input`.

### B. Form Alignment (Vertical Centering)
- **Zero Global Margin:** Global `input`, `select`, and `textarea` elements must have `margin: 0`.
- **Centering:** Label/Input pairs are placed inside flex containers (e.g., `.metadata-row`, `.control-group`) with `align-items: center`.
- **Spacing:** Global `.control-group` utilizes a `6px` gap. Specific high-density areas (Right Pane) may utilize tighter gaps (3px - 4px) via inline overrides.

### C. Button Hierarchy (Modern Minimalist)
The application avoids heavy, distracting blocks of solid color, utilizing an outline-based aesthetic to keep visual noise low while retaining clear hierarchy.
- **Primary (`.btn-primary`):** Outline aesthetic (White background, Blue text/border). Blends smoothly with secondary buttons but retains brand color. Fills solid Blue on hover.
- **Secondary (`.btn-secondary`):** White background, light gray border (`#ced4da`), dark text. Used for standard utility actions (e.g., "Cancel", "Apply").
    - **Functional Modifiers:** Secondary buttons support state context: `.success` (Green text/border) and `.danger` (Red text/border).
- **Danger (`.btn-danger`):** Standalone destructive class (White background, Red text/border). Turns solid Red on hover. Functionally identical to `.btn-secondary.danger`.
- **Ghost (`.btn-ghost`):** Subtle button appearance (very light gray `#f1f3f5` background, slight border/shadow). Used for toggles (e.g., scale toggles, "⚙ Hide Controls") where the button should look clickable but not distract from data. Turns blue when `.active`.

---

# Technical Specification: Metadata & Workspace Persistence

## 1. Fixed-Width Metadata Box
To ensure visual stability during pane resizing, the `.metadata-box` implements a non-responsive layout:
- **Fixed Width**: `375px`.
- **Constraint**: `flex-shrink: 0` prevents the box from narrowing when the center column is compressed.
- **Internal Alignment**: Labels are fixed at `90px`, and inputs are fixed at `250px`.

## 2. Accordion Control System
Complex control sets (e.g., Chart Comparison Controls) utilize a vertically stacked accordion system:
- **Container**: Rounded borders (`8px`) with a light gray background (`#f8f9fa`).
- **Headers**: Clickable bars that toggle visibility of their child content. Active headers highlight in blue and rotate their chevron icon.
- **Persistence**: Content visibility is managed via `display: block/none`.

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
- **Interaction**: Users can drag invisible **8px-wide** handles on the right edge of any header.
- **Visual Feedback**: Handle highlights with a **semi-transparent blue background** on hover and during active resizing.
- **Constraints**: Minimum width is enforced at **20px**.
- **Layout**: Uses `table-layout: fixed` to ensure column width adjustments are predictable and stable.

### B. Column Reordering (`ColumnReorderer`)
- **Interaction**: Uses the HTML5 Drag and Drop API initiated exclusively via a **Grip Handle** (`⋮⋮`, `.drag-handle`).
- **Targeting**: Headers are only marked as `draggable` when the grip handle is actively pressed (`mousedown`) to prevent interference with other interactions.
- **Visual Feedback**:
    - `.dragging-header`: 50% opacity and muted background for the column being moved.
    - `.drop-before` / `.drop-after`: Blue vertical border highlighting the insertion point.
- **ID-Bound Logic**: Rendering and reordering logic is bound to **Column IDs** (`data-col-id` or `data-field`), not array indices.

### C. Column Sorting
- **Interaction**: Triggered by clicking the **Column Label** (`.sort-label`). 
- **Exclusion**: Interaction with the grip handle or resize handle does not trigger sorting.
- **Visuals**: Sort state is indicated by `.sort-icon` (▲/▼) appended after the label.

### D. Layout Persistence
- **Storage**: Layout preferences are saved in `localStorage` using unique keys (e.g., `table-widths-measurements`, `table-column-order-measurements`).
- **Logic**: Widths and orders are stored as ID-to-Value maps. This ensures that a column's width follows it even after it has been moved to a new position.

## 4. Floating Window Management

### A. Viewport Clamping & Containment
To prevent windows from becoming unreachable or obscuring critical UI, all floating elements implement strict clamping logic during dragging and viewport resizing via the `drag_utils.js` utility.

#### 1. Viewport Clamping (Analysis Window)
- **Scope**: Used for windows that float globally over the entire application.
- **Constraint**: At least **30px** of the window's header must remain within the visible viewport.
- **Vertical**: `top >= 0` (cannot disappear above the top).
- **Horizontal**: At least 30px of the header must stay within the left/right viewport edges.

#### 2. Parent Containment (Legend)
- **Scope**: Used for pane-specific elements that must not cross layout boundaries (gutters).
- **Structure**: Nested within `#comparison-chart-wrapper` to ensure it is included in image exports.
- **Constraint**: The element is strictly clamped to the boundaries of its **Right Pane Wrapper** (`offsetParent`).
- **Gutter Protection**: Clamping prevents the legend from crossing the gutter line into the center or left columns.

### B. Stacking Order (z-index)
Floating elements utilize a high `z-index` to ensure they remain interactive and visible on top of collapsible columns, gutters, and data tables.
- **Analysis Window**: `z-index: 2000`.
- **Legend Window**: `z-index: 1500`.
- **Comparison**: Standard layout elements (gutters, columns) occupy `z-index: 10-30`.

### C. Implementation Details
- **Module**: `static/js/ui/drag_utils.js` provides the shared `enableDragging` utility with `containment: 'parent' | 'viewport'` options.
- **Logic Persistence**: Clamping is reapplied on the window `resize` event to maintain accessibility.

## 5. Analysis HUD System

### A. HUD Architecture
The Analyze pane utilizes a high-density "Interactive Inspector" HUD (Heads-Up Display) for real-time data verification.
- **Header**: Contains window management and a clear title.
- **Control Bar**: Compact horizontal bar for scale toggles (Log/Linear) and regression selection.
- **Chart Area**: Centrally aligned, flex-growing canvas utilizing the standardized chart wrapper.
- **Results Card**: Dedicated footer area displaying mathematical physical parameters (a, b, m, c) and $R^2$ fit quality using KaTeX.

### B. Visual Logic
- **Color Coding**: Results in the card are color-coded to match the chart lines (Red for Linear, Blue for Power Law).
- **Adaptive Sizing**: The window has a minimum height to ensure the results card is always visible without truncating the chart.

## 6. Implementation Details
- **Modules**:
    - `static/js/ui/table_resizer.js`: Logic for drag-to-resize handles.
    - `static/js/ui/column_reorderer.js`: Logic for drag-to-reorder headers.
    - `static/js/ui/measurement_ui.js`: Order-aware rendering for the measurement list.
    - `static/js/ui/drag_utils.js`: Viewport and Parent clamped dragging for floating elements.
- **CSS**: Located in the "Table Styles", "Floating Window", and "Analysis HUD" sections of `static/style.css`.