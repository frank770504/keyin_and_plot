# Technical Specification: Unified Reactive Chart Engine

## 1. Overview
The Unified Reactive Chart Engine provides a high-performance, consistent visualization layer for both the Comparison Chart (multiple measurements) and the Analysis Chart (single measurement). It replaces imperative drawing commands with a reactive, state-driven model.

## 2. Core Visualization Features

### A. Scale Management
- **Dual-Axis Logarithm Support**: Both X ($\dot{\gamma}$) and Y ($\sigma$) axes can be independently toggled between `linear` and `logarithmic` scales.
- **Scientific Formatting**: Logarithmic scales automatically use scientific notation (e.g., $1e+1$) for ticks.
- **Stability**: Axis titles (LaTeX-rendered) maintain their position and formatting during scale transitions.

### B. Visual Encoding
- **Color Palette**: A fixed 10-color cycle ensuring distinct colors for overlapping measurements.
- **Point Styles**: A unique sequence of 9 point styles (circle, rect, triangle, etc.) paired with colors to provide secondary visual distinction for color-blind accessibility and high-density plots.
- **Regression Styling**: 
    - **Power Law**: Thin solid line with slight smoothing (`tension: 0.1`) and `[5, 5]` dash pattern.
    - **Linear**: Thin solid line with `[10, 5]` dash pattern.

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

## 4. Unified GUI (Analysis vs. Comparison)
Both chart interfaces implement an identical control bar:
- **Scale Toggles**: `X-Log` and `Y-Log` buttons.
- **Regression Toggles**: `Linear` and `Power` law checkboxes.
- **Viewport Control**: A `Reset Zoom` button (⟲) that appears on hover/interaction to restore auto-fitted scales.

## 5. Implementation Details
- **Orchestrator**: `static/js/chart_service.js` (Handles Chart.js initialization, LaTeX plugin, and caching).
- **LaTeX Integration**: A custom Chart.js plugin (`katexChartPlugin`) manages the lifecycle of KaTeX-rendered axis titles and tooltips.
- **Dependencies**: Chart.js 4.x, KaTeX, chartjs-plugin-zoom.
