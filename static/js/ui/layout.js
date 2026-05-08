// static/js/ui/layout.js

import { enableDragging } from './drag_utils.js';

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
        enableDragging(this.window, this.header);
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
        this.initResizeObserver();
    }

    initResizeObserver() {
        if (this.onResize) {
            let resizeTimer;
            const ro = new ResizeObserver(() => {
                // ResizeObserver fires whenever the observed element changes size
                // Debounce to prevent infinite loops and improve performance
                cancelAnimationFrame(resizeTimer);
                resizeTimer = requestAnimationFrame(() => {
                    this.onResize();
                });
            });
            ro.observe(this.column);
        }
    }

    startDrag(e) {
        // Prepare to "pull" it open if collapsed
        if (this.column.classList.contains('collapsed')) {
            this.column.classList.remove('collapsed');
            this.column.style.width = '0px';
        }

        this.isDragging = true;
        document.body.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        this.gutter.classList.add('dragging');

        const mouseMoveHandler = (e) => this.doDrag(e);
        const mouseUpHandler = () => {
            this.isDragging = false;
            document.body.classList.remove('resizing');
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
