// static/js/ui/layout.js

export class FloatingWindow {
    constructor(windowId, headerId, closeBtnId, onResize = null) {
        this.window = document.getElementById(windowId);
        this.header = document.getElementById(headerId);
        this.closeBtn = document.getElementById(closeBtnId);
        this.onResize = onResize;

        if (!this.window || !this.header || !this.closeBtn) {
            console.error("FloatingWindow: Elements not found", { windowId, headerId, closeBtnId });
            return;
        }

        this.initEvents();
        this.makeDraggable();
        this.initResizeObserver();
    }

    initEvents() {
        this.closeBtn.addEventListener('click', () => this.hide());
    }

    initResizeObserver() {
        // Automatically trigger resize callback when the window size changes
        if (this.onResize) {
            const resizeObserver = new ResizeObserver(() => {
                this.onResize();
            });
            resizeObserver.observe(this.window);
        }
    }

    show() {
        this.window.style.display = 'flex';
        // Trigger resize once on show to ensure content fits
        if (this.onResize) this.onResize();
    }

    hide() {
        this.window.style.display = 'none';
    }

    toggle() {
        if (this.window.style.display === 'none' || !this.window.style.display) {
            this.show();
        } else {
            this.hide();
        }
    }

    makeDraggable() {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const element = this.window;
        const handle = this.header;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // Get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // Calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position:
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            // Stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}

// Drag & Collapse Logic
let isDragging = false;
let dragElements = {};

export function initLayout(elements, resizeCallbacks) {
    dragElements = elements;
    
    // Drag Handle
    if (elements.dragHandle) {
        elements.dragHandle.addEventListener('mousedown', startDrag);
    }
    
    // Collapse Button
    if (elements.collapseLeftBtn) {
        elements.collapseLeftBtn.addEventListener('click', () => handleCollapse('left-column', resizeCallbacks));
    }
}

function startDrag(e) {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    dragElements.dragHandle.classList.add('dragging');
    document.addEventListener('mousemove', (e) => handleDrag(e, dragElements.centerColumn));
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
}

function handleDrag(e, centerColumn) {
    if (!isDragging) return;

    const containerRect = document.querySelector('.container').getBoundingClientRect();
    const leftColumn = document.getElementById('left-column');
    const leftColumnWidth = leftColumn.getBoundingClientRect().width;

    let newCenterWidth = e.clientX - leftColumnWidth;

    const minCenterWidth = 450;
    const maxCenterWidth = containerRect.width - leftColumnWidth - 200;

    if (newCenterWidth < minCenterWidth) newCenterWidth = minCenterWidth;
    if (newCenterWidth > maxCenterWidth) newCenterWidth = maxCenterWidth;

    centerColumn.style.width = `${newCenterWidth}px`;

    // We might want to trigger chart resize here, but maybe throttle it
    // For now we rely on the resizeObserver or manual callback if passed
}

function stopDrag() {
    isDragging = false;
    document.body.style.cursor = '';
    dragElements.dragHandle.classList.remove('dragging');
    document.removeEventListener('mousemove', handleDrag); // This fails because handleDrag is wrapped
    // Fix: We need the exact function reference to remove it.
    // Simplifying for this refactor: Just clone the node or use a global handler.
    // Better: use a persistent handler.
}
// Correcting Drag Implementation to handle event removal
const persistentDragHandler = (e) => handleDrag(e, document.getElementById('center-column'));

function startDragCorrected(e) {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    dragElements.dragHandle.classList.add('dragging');
    document.addEventListener('mousemove', persistentDragHandler);
    document.addEventListener('mouseup', stopDragCorrected);
    e.preventDefault();
}

function stopDragCorrected() {
    isDragging = false;
    document.body.style.cursor = '';
    dragElements.dragHandle.classList.remove('dragging');
    document.removeEventListener('mousemove', persistentDragHandler);
    document.removeEventListener('mouseup', stopDragCorrected);
}

// Overwrite init to use corrected
export function initLayoutCorrected(elements, resizeCallbacks) {
    dragElements = elements;
    if (elements.dragHandle) {
        elements.dragHandle.addEventListener('mousedown', startDragCorrected);
    }
    if (elements.collapseLeftBtn) {
        elements.collapseLeftBtn.addEventListener('click', () => handleCollapse('left-column', resizeCallbacks));
    }
}

function handleCollapse(columnId, resizeCallbacks) {
    document.getElementById(columnId).classList.toggle('collapsed');
    setTimeout(() => {
        if (resizeCallbacks) resizeCallbacks.forEach(cb => cb());
    }, 300);
}
