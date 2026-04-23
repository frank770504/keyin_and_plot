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
        if (this.onResize) {
            const resizeObserver = new ResizeObserver(() => {
                this.onResize();
            });
            resizeObserver.observe(this.window);
        }
    }

    show() {
        this.window.style.display = 'flex';
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

        handle.onmousedown = (e) => {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (e) => {
                e = e || window.event;
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.left = (element.offsetLeft - pos1) + "px";
            };
        };
    }
}

class ResizableColumn {
    constructor(columnId, gutterId, collapseBtnId, minWidth = 100, onResize = null) {
        this.column = document.getElementById(columnId);
        this.gutter = document.getElementById(gutterId);
        this.collapseBtn = document.getElementById(collapseBtnId);
        this.minWidth = minWidth;
        this.onResize = onResize;

        this.isDragging = false;
        this.lastWidth = this.column.getBoundingClientRect().width || 300;

        this.init();
    }

    init() {
        if (this.gutter) {
            this.gutter.addEventListener('mousedown', (e) => this.startDrag(e));
        }
        if (this.collapseBtn) {
            this.collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent drag trigger
                this.toggleCollapse();
            });
        }
    }

    startDrag(e) {
        if (this.column.classList.contains('collapsed')) return;

        this.isDragging = true;
        document.body.style.cursor = 'col-resize';
        this.gutter.classList.add('dragging');

        const mouseMoveHandler = (e) => this.doDrag(e);
        const mouseUpHandler = () => {
            this.isDragging = false;
            document.body.style.cursor = '';
            this.gutter.classList.remove('dragging');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        e.preventDefault();
    }

    doDrag(e) {
        if (!this.isDragging) return;

        const container = document.querySelector('.container');
        const containerRect = container.getBoundingClientRect();
        const columnRect = this.column.getBoundingClientRect();

        // Calculate new width relative to the column's left edge
        let newWidth = e.clientX - columnRect.left;

        // Constraints
        const maxWidth = containerRect.width - 200; // Leave space for right column
        if (newWidth < this.minWidth) newWidth = this.minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        this.column.style.width = `${newWidth}px`;
        this.lastWidth = newWidth;

        if (this.onResize) this.onResize();
    }

    toggleCollapse() {
        const isCollapsing = !this.column.classList.contains('collapsed');

        if (isCollapsing) {
            this.lastWidth = this.column.getBoundingClientRect().width;
            this.column.classList.add('collapsed');
            this.column.style.width = '0';
        } else {
            this.column.classList.remove('collapsed');
            this.column.style.width = `${this.lastWidth}px`;
        }

        // Trigger resize after transition
        setTimeout(() => {
            if (this.onResize) this.onResize();
        }, 310);
    }
}

export function initLayout(elements, resizeCallbacks) {
    const triggerResizes = () => {
        if (resizeCallbacks) resizeCallbacks.forEach(cb => cb());
    };

    // Initialize Left Column
    new ResizableColumn('left-column', 'gutter-left', 'collapse-left', 150, triggerResizes);

    // Initialize Center Column
    new ResizableColumn('center-column', 'gutter-center', 'collapse-center', 200, triggerResizes);
}
