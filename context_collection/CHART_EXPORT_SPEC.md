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
