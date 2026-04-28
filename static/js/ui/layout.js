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

export class ResizableColumn {
    constructor(config) {
        this.column = config.column;
        this.gutter = config.gutter;
        this.collapseBtn = config.collapseBtn;
        this.minWidth = config.minWidth || 0;
        this.snapThreshold = config.snapThreshold || 50;
        this.onResize = config.onResize;

        this.isDragging = false;
        this.lastWidth = this.column.getBoundingClientRect().width || 250;

        this.init();
    }

    init() {
        if (this.gutter) {
            this.gutter.addEventListener('mousedown', (e) => this.startDrag(e));
        }
        if (this.collapseBtn) {
            // CRITICAL: Stop mousedown bubbling to prevent gutter from stripping 'collapsed' class
            this.collapseBtn.addEventListener('mousedown', (e) => e.stopPropagation());

            this.collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCollapse();
            });
        }
    }

    startDrag(e) {
        // Prepare to "pull" it open if collapsed
        if (this.column.classList.contains('collapsed')) {
            this.column.classList.remove('collapsed');
            this.column.style.width = '0px';
        }

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

        let newWidth = e.clientX - columnRect.left;
        const maxWidth = containerRect.width;

        if (newWidth > maxWidth) newWidth = maxWidth;

        if (newWidth < this.snapThreshold) {
            this.column.style.width = '0px';
            if (!this.column.classList.contains('collapsed')) {
                this.column.classList.add('collapsed');
            }
        } else {
            if (this.column.classList.contains('collapsed')) {
                this.column.classList.remove('collapsed');
            }
            this.column.style.width = `${newWidth}px`;
            this.lastWidth = newWidth;
        }

        if (this.onResize) this.onResize();
    }

    toggleCollapse() {
        const isCurrentlyCollapsed = this.column.classList.contains('collapsed');

        if (!isCurrentlyCollapsed) {
            // Hiding
            const currentWidth = this.column.getBoundingClientRect().width;
            if (currentWidth >= this.snapThreshold) {
                this.lastWidth = currentWidth;
            }
            this.column.classList.add('collapsed');
            this.column.style.width = '0';
        } else {
            // Showing
            this.column.classList.remove('collapsed');
            if (this.lastWidth < this.snapThreshold) this.lastWidth = 250;
            this.column.style.width = `${this.lastWidth}px`;
        }

        setTimeout(() => {
            if (this.onResize) this.onResize();
        }, 310);
    }
}

/**
 * Initializes resizable columns based on provided elements.
 * Returns an object containing the ResizableColumn instances.
 */
export function initLayout(elements, resizeCallbacks) {
    const triggerResizes = () => {
        if (resizeCallbacks) resizeCallbacks.forEach(cb => cb());
    };

    const left = new ResizableColumn({
        column: elements.leftColumn,
        gutter: elements.gutterLeft,
        collapseBtn: elements.collapseLeftBtn,
        minWidth: 0,
        snapThreshold: 50,
        onResize: triggerResizes
    });

    const center = new ResizableColumn({
        column: elements.centerColumn,
        gutter: elements.gutterCenter,
        collapseBtn: elements.collapseCenterBtn,
        minWidth: 0,
        snapThreshold: 50,
        onResize: triggerResizes
    });

    return { left, center };
}
