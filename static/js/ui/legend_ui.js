// static/js/ui/legend_ui.js

export function createFloatingLegend(chartInstance, legendElement) {
    if (!chartInstance || !legendElement) return;

    // Reset content but keep layout structure if possible? 
    // Actually, simpler to rebuild since it's cheap.
    legendElement.innerHTML = '';
    legendElement.style.display = 'flex'; // Ensure flex display

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
        checkbox.style.marginRight = '8px';
        checkbox.style.cursor = 'pointer';

        const colorBox = document.createElement('span');
        colorBox.className = 'legend-color-box';
        colorBox.style.backgroundColor = item.fillStyle;
        colorBox.style.border = `1px solid ${item.strokeStyle}`;

        const text = document.createElement('span');
        text.textContent = item.text;
        text.style.cursor = 'pointer';

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(colorBox);
        itemDiv.appendChild(text);

        const handleToggle = (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }

            const datasetIndex = item.datasetIndex;
            chartInstance.setDatasetVisibility(datasetIndex, checkbox.checked);
            chartInstance.update();

            // Update strike-through style
            if (!checkbox.checked) {
                itemDiv.classList.add('hidden');
            } else {
                itemDiv.classList.remove('hidden');
            }
        };

        checkbox.addEventListener('change', handleToggle);
        text.addEventListener('click', handleToggle);
        colorBox.addEventListener('click', handleToggle);

        content.appendChild(itemDiv);
    });
}

export function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        // Only allow dragging via the header
        if (!e.target.classList.contains('legend-header')) {
            return;
        }

        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}
