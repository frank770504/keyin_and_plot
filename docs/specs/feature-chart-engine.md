# Technical Specification: Unified Reactive Chart Engine

## 1. Overview
The Unified Reactive Chart Engine provides a high-performance, consistent visualization layer for both the Measurement Plots (multiple measurements) and the Analyze Chart (single measurement). It replaces imperative drawing commands with a reactive, state-driven model.

## 2. Core Visualization Features

### A. Scale Management
- **Dual-Axis Logarithm Support**: Both X ($\dot{\gamma}$) and Y ($\sigma$) axes can be independently toggled between `linear` and `logarithmic` scales.
- **Scientific Formatting**: Logarithmic scales automatically use scientific notation (e.g., $1e+1$) for ticks.
- **Stability**: Axis titles (LaTeX-rendered) maintain their position and formatting during scale transitions.

### B. Visual Encoding
- **Dynamic Color Generation**: Replaces fixed palettes with a mathematical generator using the **Golden Ratio Conjugate** (~0.618) to step through the Hue spectrum in HSV space. This ensures visually distinct colors regardless of the number of selected measurements.
- **Aesthetic Constraints**: Uses a "Balanced" configuration (Saturation: 0.5, Value: 0.9) to provide vibrant but readable lines.
- **Point Styles**: A unique sequence of 9 point styles (circle, rect, triangle, etc.) paired with colors to provide secondary visual distinction for color-blind accessibility and high-density plots.
- **Regression Styling**: 
    - **Power Law**: Thin solid line with slight smoothing (`tension: 0.1`) and `[5, 5]` dash pattern.
    - **Linear**: Thin solid line with `[10, 5]` dash pattern.

### C. Interaction & Tooltips
- **Forgiving Hover Detection**: Regression lines use an expanded `hitRadius` and `pointHitRadius` (15px) to ensure tooltips are easy to trigger without pixel-perfect precision.
- **Nearest-Point Logic**: The engine uses `mode: 'nearest'` and `intersect: false` globally, allowing tooltips to follow the cursor smoothly across all data points and regression segments.
- **High-Density Search**: Leveraging 100-point regression segments from the backend ensures reliable interaction even at extreme zoom levels.
- **Coordinate Robustness**: Tooltip positioning is calculated relative to the chart area, ensuring accuracy during active panning and zooming.

## 3. Performance & Efficiency

### A. Client-Side Data Caching
- **Mechanism**: The `chart_service.js` maintains a `Map`-based cache of measurement points.
- **Invalidation**: Cache entries are explicitly cleared whenever:
    - A point is added, updated, or deleted.
    - Measurement metadata (Spindle ID) is modified (as it affects calculated values).
    - A measurement is deleted globally.

### B. Reactive Pipeline
- **State-Driven**: UI controls (checkboxes, toggle buttons) update a central `state.chartConfig` object.
- **Auto-Update**: Any state change or data modification triggers an immediate re-render of the relevant chart instance.

## 4. Unified GUI (Analyze vs. Measurement Plots)
Both chart interfaces implement an identical control bar:
- **Scale Toggles**: `X-Log` and `Y-Log` buttons.
- **Regression Toggles**: `Linear` and `Power` law checkboxes.
- **Custom Curve Management**: A dynamic list of badges for active custom curves, each providing a delete button (×) for individual removal.
- **Viewport Control**: A `Reset Zoom` button (⟲) that appears on hover/interaction to restore auto-fitted scales.

## 5. Implementation Details
- **Orchestrator**: `static/js/chart_service.js` (Handles Chart.js initialization, LaTeX plugin, and caching).
- **LaTeX Integration**: A custom Chart.js plugin (`katexChartPlugin`) manages the lifecycle of KaTeX-rendered axis titles and tooltips.
- **Dependencies**: Chart.js 4.x, KaTeX, chartjs-plugin-zoom.

---

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
- **Editable Title**: An input field at the top of the chart container allows users to set a custom title for the comparison plot (Default: "Rheology Compare").
- **Save as Image**: A button in the controls allows users to export the entire chart container (Title, Chart, and Floating Legend). 
    - **Technical Details**: See Export System for DPI scaling and SVG normalization logic.
- **General Reset View**: A "Reset Zoom" button (⟲) appears as an overlay in the top-right corner of the chart container.
- **Visibility**: The button is only visible when a plot exists.
- **Behavior**: Clicking the button calls `resetZoom()` to restore the chart to its original auto-fit scales, undoing all pan and zoom actions.

## 4. Implementation Details
- **Main Controller**: `static/js/main.js` handles the coordination between selection events and chart updates.
- **UI Module**: `static/js/ui/measurement_ui.js` manages the rendering of checkboxes and the master checkbox state.
- **Chart Service**: `static/js/chart_service.js` provides the `initializeOrUpdateChart`, `destroyChart`, and `getSelectedMeasurementsForChart` functions.

---

# Technical Specification: Professional Chart Export System

## 1. Overview
The Chart Export System allows users to save the Measurement Comparison workspace (including the editable title, the interactive chart, and the floating legend) as high-resolution image files. It is designed to produce publication-quality output in both raster (PNG) and vector (SVG) formats.

## 2. UI Components
- **Editable Chart Title**: A `contenteditable` heading located directly above the chart canvas. It defaults to "Rheology Compare". This element is rendered as native text in the export, avoiding the "input box" appearance.
- **Permanent Export Bar**: A control group located in the right-pane header (permanently visible even when advanced chart controls are hidden). It contains:
    - **Format Selector**: Dropdown for PNG or SVG.
    - **DPI Selector**: Options for 96 DPI (Web), 300 DPI (Print), and 600 DPI (Ultra-High).
    - **Save Button**: Triggers the serialized capture and download process.

## 3. Export Logic & Processing

### A. High-Resolution Scaling (DPI)
To prevent the Chart.js canvas from appearing blurry in high-resolution exports, the system implements a dynamic pixel-density boost:
1.  **Scale Calculation**: A `scale` factor is derived from the selected DPI (e.g., 300 DPI corresponds to a ~3.125x scale).
2.  **Resolution Injection**: The Chart.js `devicePixelRatio` is temporarily set to `window.devicePixelRatio * scale`.
3.  **Forced Redraw**: The chart's `resize()` method is called to regenerate the canvas at the higher native resolution.
4.  **Restoration**: After capture, the original `devicePixelRatio` is restored to maintain UI performance.

### B. PNG Export
- **Technology**: Utilizes `dom-to-image-more`.
- **Filtering**: A filter function excludes UI-only elements (e.g., `#reset-zoom-btn`) from the capture.
- **Background**: Explicitly sets a white background (`#ffffff`) to ensure transparency doesn't interfere with readability.

### C. SVG Export (Vector Normalization)
Since browsers generate SVGs optimized for the web, the system applies an advanced normalization pipeline to ensure the files are valid XML and compatible with standalone viewers (Nautilus, EOG) and vector editors (Inkscape):
1.  **XHTML Compliance**: A post-processing regex ensures all self-closing tags (e.g., `<input />`, `<img />`, `<br />`) are properly closed, preventing "XML Parsing Error: unclosed token" in strictly-parsed environments.
2.  **Namespace Management**: Safe injection of `xmlns="http://www.w3.org/1999/xhtml"` and `xmlns:xlink` namespaces. The system strips existing duplicates before injection to prevent "Attribute xmlns redefined" errors.
3.  **Absolute Dimensioning**: All relative dimensions (e.g., `width="100%"`) in the `foreignObject` and SVG root are replaced with absolute pixel values derived from the DOM at export time.
4.  **Encoding**: Uses a `fetch()`-based decoding of the data URL to handle complex encodings and UTF-8 characters reliably.
5.  **Standard Headers**: Prepends the standard `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` declaration and ensures the `viewBox` is correctly set for thumbnailing.

## 4. Implementation Details
- **Main Controller**: `handleSaveChart()` in `static/js/main.js`.
- **Dependency**: `dom-to-image-more` (included via CDN in `index.html`).
- **Naming**: Filenames are automatically generated from the editable title, sanitized into lowercase with underscores (e.g., `rheology_compare.png`).