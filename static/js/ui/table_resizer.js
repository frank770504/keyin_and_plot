// static/js/ui/table_resizer.js

/**
 * Enables column resizing for a table and persists widths in localStorage.
 */
export class TableResizer {
    constructor(table, storageKey) {
        this.table = table;
        this.storageKey = storageKey;
        this.headers = Array.from(table.querySelectorAll('thead th'));
        this.isDragging = false;
        this.activeHeader = null;
        this.startX = 0;
        this.startWidth = 0;

        this.init();
    }

    init() {
        this.loadWidths();
        this.headers.forEach((th, index) => {
            // Create and append resizer handle
            // We append to th (absolute positioned relative to th)
            const resizer = document.createElement('div');
            resizer.classList.add('resizer');
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevent sort toggle on mousedown
                this.startDragging(e, th);
            });

            resizer.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent sort toggle on click
            });
        });

        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDragging());
    }

    startDragging(e, th) {
        this.isDragging = true;
        this.activeHeader = th;
        this.startX = e.pageX;
        this.startWidth = th.offsetWidth;
        this.table.classList.add('resizing-column');
        document.body.style.cursor = 'col-resize';
    }

    drag(e) {
        if (!this.isDragging || !this.activeHeader) return;

        const deltaX = e.pageX - this.startX;
        const newWidth = Math.max(20, this.startWidth + deltaX);
        this.activeHeader.style.width = `${newWidth}px`;
    }

    stopDragging() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.activeHeader = null;
        this.table.classList.remove('resizing-column');
        document.body.style.cursor = '';
        this.saveWidths();
    }

    saveWidths() {
        const widths = {};
        this.headers.forEach(th => {
            const colId = th.dataset.colId || th.dataset.field; // field for points table
            if (colId && th.style.width) {
                widths[colId] = th.style.width;
            }
        });
        localStorage.setItem(this.storageKey, JSON.stringify(widths));
    }

    loadWidths() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                this.headers.forEach(th => {
                    const colId = th.dataset.colId || th.dataset.field;
                    if (colId && widths[colId]) {
                        th.style.width = widths[colId];
                    }
                });
            } catch (e) {
                console.error('Failed to load table widths', e);
            }
        }
    }
}
