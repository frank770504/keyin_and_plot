# Technical Specification: Reactive Measurement Plotting System

## 1. Overview
The measurement plotting system allows users to visualize multiple rheology measurements simultaneously on a single chart. The system is designed to be reactive, eliminating the need for manual "Draw" triggers and ensuring the chart always reflects the current selection state.

## 2. Selection Interface (Measurement List)

### A. Reactive Selection
- **Plot Column**: The selection column is labeled "Plot" to clearly indicate its function.
- **Enhanced Click Target**: The entire `td` cell containing the plot checkbox is clickable. Clicking anywhere in the cell toggles the checkbox state.
- **Isolation**: Clicks within the "Plot" column stop event propagation (`stopPropagation()`) to prevent accidentally switching the active measurement in the workspace (middle column).
- **Auto-Sync**: Toggling a checkbox immediately triggers a re-render of the Measurement Plots.

### B. Master Control (Batch Toggling)
- **Master Checkbox**: A checkbox in the "Plot" table header allows for batch actions.
- **Selection Logic**:
    - **Check**: Selects all measurements currently *visible* in the list (respecting any active RQL search filters).
    - **Uncheck**: Deselects all measurements currently *visible* in the list (respecting any active RQL search filters).
- **Visual Feedback**:
    - **Checked**: All visible measurements are plotted.
    - **Indeterminate (dash)**: Some, but not all, visible measurements are plotted.
    - **Unchecked**: No visible measurements are plotted.

## 3. Chart Behavior & Maintenance

### A. Lifecycle Management
- **Automatic Destruction**: If no measurements are selected, the chart instance is destroyed, and the container is cleared.
- **LaTeX Cleanup**: The system explicitly removes KaTeX-rendered axis title elements (`.katex-axis-title-x`, `.katex-axis-title-y`) during chart destruction to prevent "ghost" labels from remaining in the UI.

### B. Viewport Control
- **General Reset View**: A "Reset Zoom" button (⟲) appears as an overlay in the top-right corner of the chart container.
- **Visibility**: The button is only visible when a plot exists.
- **Behavior**: Clicking the button calls `resetZoom()` to restore the chart to its original auto-fit scales, undoing all pan and zoom actions.

## 4. Implementation Details
- **Main Controller**: `static/js/main.js` handles the coordination between selection events and chart updates.
- **UI Module**: `static/js/ui/measurement_ui.js` manages the rendering of checkboxes and the master checkbox state.
- **Chart Service**: `static/js/chart_service.js` provides the `initializeOrUpdateChart`, `destroyChart`, and `getSelectedMeasurementsForChart` functions.
