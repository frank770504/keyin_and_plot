import { enableDragging } from './drag_utils.js';

function createLegendIcon(dataset, strokeColor, fillColor) {
    const pointStyle = dataset.pointStyle || 'circle';
    const isLine = dataset.type === 'line';
    const borderDash = dataset.borderDash || [];

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.style.marginRight = '8px';
    svg.style.flexShrink = '0';

    const centerX = 7;
    const centerY = 7;
    const size = 5; // Half-size for shapes

    if (isLine && dataset.pointRadius === 0) {
        // Line-only dataset (Regression)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '7');
        line.setAttribute('x2', '14');
        line.setAttribute('y2', '7');
        line.setAttribute('stroke', strokeColor);
        line.setAttribute('stroke-width', '2');
        if (borderDash.length > 0) {
            line.setAttribute('stroke-dasharray', borderDash.join(','));
        }
        svg.appendChild(line);
    } else {
        // Scatter dataset or line with points
        let shape;
        switch (pointStyle) {
            case 'rect':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('x', '2');
                shape.setAttribute('y', '2');
                shape.setAttribute('width', '10');
                shape.setAttribute('height', '10');
                break;
            case 'triangle':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                shape.setAttribute('d', `M ${centerX} 2 L 12 12 L 2 12 Z`);
                break;
            case 'rectRot':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                shape.setAttribute('d', `M ${centerX} 2 L 12 ${centerY} L ${centerX} 12 L 2 ${centerY} Z`);
                break;
            case 'cross':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                shape.setAttribute('d', `M 2 ${centerY} L 12 ${centerY} M ${centerX} 2 L ${centerX} 12`);
                shape.setAttribute('fill', 'none');
                shape.setAttribute('stroke-width', '2');
                break;
            case 'crossRot':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                shape.setAttribute('d', `M 3 3 L 11 11 M 11 3 L 3 11`);
                shape.setAttribute('fill', 'none');
                shape.setAttribute('stroke-width', '2');
                break;
            case 'star':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                shape.setAttribute('d', `M 2 ${centerY} L 12 ${centerY} M ${centerX} 2 L ${centerX} 12 M 3 3 L 11 11 M 11 3 L 3 11`);
                shape.setAttribute('fill', 'none');
                shape.setAttribute('stroke-width', '1.5');
                break;
            case 'circle':
            default:
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                shape.setAttribute('cx', centerX);
                shape.setAttribute('cy', centerY);
                shape.setAttribute('r', '5');
                break;
        }
        shape.setAttribute('stroke', strokeColor);
        if (!shape.hasAttribute('fill')) {
            shape.setAttribute('fill', fillColor || 'transparent');
        }
        svg.appendChild(shape);
    }
    return svg;
}

export function createFloatingLegend(chartInstance, legendElement, showLegend = true) {
    if (!chartInstance || !legendElement) return;

    legendElement.innerHTML = '';
    legendElement.style.display = showLegend ? 'flex' : 'none';

    // 1. Create Header
    const header = document.createElement('div');
    header.className = 'legend-header';
    header.textContent = 'Legend';
    legendElement.appendChild(header);

    // 2. Create Content Container
    const content = document.createElement('div');
    content.className = 'legend-content';
    legendElement.appendChild(content);

    const items = chartInstance.options.plugins.legend.labels.generateLabels(chartInstance);

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'floating-legend-item';
        if (item.hidden) itemDiv.classList.add('hidden');

        // Checkbox for visibility
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !item.hidden;
        checkbox.className = 'legend-checkbox';

        const ds = chartInstance.data.datasets[item.datasetIndex];
        const icon = createLegendIcon(ds, item.strokeStyle, item.fillStyle);

        const text = document.createElement('span');
        text.textContent = item.text;
        text.style.cursor = 'pointer';

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(icon);
        itemDiv.appendChild(text);

        const handleToggle = (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }

            const datasetIndex = item.datasetIndex;
            chartInstance.setDatasetVisibility(datasetIndex, checkbox.checked);
            chartInstance.update();

            if (!checkbox.checked) {
                itemDiv.classList.add('hidden');
            } else {
                itemDiv.classList.remove('hidden');
            }
        };

        checkbox.addEventListener('change', handleToggle);
        text.addEventListener('click', handleToggle);
        icon.addEventListener('click', handleToggle);

        content.appendChild(itemDiv);
    });

    // Render LaTeX in the legend
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(legendElement, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }

    // Enable dragging for the newly created header
    enableDragging(legendElement, header, { containment: 'parent' });
}
