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
