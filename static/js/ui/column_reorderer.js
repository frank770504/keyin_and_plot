// static/js/ui/column_reorderer.js

/**
 * Enables column reordering for a table by dragging headers.
 */
export class ColumnReorderer {
    constructor(table, storageKey, onReorder) {
        this.table = table;
        this.storageKey = storageKey;
        this.onReorder = onReorder;
        this.thead = table.querySelector('thead');
        this.headers = Array.from(this.thead.querySelectorAll('th'));
        this.draggedHeader = null;

        this.init();
    }

    init() {
        this.loadOrder();
        this.headers.forEach(th => {
            // Checkbox column usually shouldn't be reordered if it's the first
            if (th.classList.contains('checkbox-column')) return;

            // Wrap existing content or ensure header-content exists
            let content = th.querySelector('.header-content');
            if (!content) {
                content = document.createElement('div');
                content.classList.add('header-content');
                while (th.firstChild) content.appendChild(th.firstChild);
                th.appendChild(content);
            }

            // Add drag handle if it doesn't exist
            if (!content.querySelector('.drag-handle')) {
                const handle = document.createElement('div');
                handle.classList.add('drag-handle');
                handle.innerHTML = '&#8942;&#8942;'; // ⋮⋮
                handle.title = 'Drag to reorder';
                content.insertBefore(handle, content.firstChild);
            }

            // By default, headers are not draggable. We only enable it when the handle is pressed.
            th.draggable = false;
            th.classList.add('draggable-header');

            const handle = content.querySelector('.drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', () => {
                    th.draggable = true;
                });
            }

            th.addEventListener('dragstart', (e) => {
                this.dragStart(e, th);
            });
            th.addEventListener('dragover', (e) => this.dragOver(e, th));
            th.addEventListener('drop', (e) => this.drop(e, th));
            th.addEventListener('dragend', () => {
                this.dragEnd();
                th.draggable = false; // Disable until next handle mousedown
            });

            // Safety: if mouseup happens without a drag starting, reset draggable
            window.addEventListener('mouseup', () => {
                if (th.draggable && !this.draggedHeader) {
                    th.draggable = false;
                }
            });
        });
    }

    dragStart(e, th) {
        this.draggedHeader = th;
        e.dataTransfer.effectAllowed = 'move';
        th.classList.add('dragging-header');
    }

    dragOver(e, th) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (th !== this.draggedHeader) {
            const rect = th.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            if (e.clientX < midpoint) {
                th.classList.add('drop-before');
                th.classList.remove('drop-after');
            } else {
                th.classList.add('drop-after');
                th.classList.remove('drop-before');
            }
        }
    }

    drop(e, th) {
        e.preventDefault();
        th.classList.remove('drop-before', 'drop-after');

        if (th !== this.draggedHeader) {
            const rect = th.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;

            if (e.clientX < midpoint) {
                this.thead.querySelector('tr').insertBefore(this.draggedHeader, th);
            } else {
                this.thead.querySelector('tr').insertBefore(this.draggedHeader, th.nextSibling);
            }

            this.saveOrder();
            if (this.onReorder) this.onReorder();
        }
    }

    dragEnd() {
        this.draggedHeader.classList.remove('dragging-header');
        this.headers.forEach(th => th.classList.remove('drop-before', 'drop-after'));
        this.draggedHeader = null;
    }

    saveOrder() {
        const order = Array.from(this.thead.querySelectorAll('th')).map(th => th.dataset.colId);
        localStorage.setItem(this.storageKey, JSON.stringify(order));
    }

    loadOrder() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const order = JSON.parse(saved);
                const headerMap = new Map();
                this.headers.forEach(th => headerMap.set(th.dataset.colId, th));

                const tr = this.thead.querySelector('tr');
                order.forEach(colId => {
                    if (headerMap.has(colId)) {
                        tr.appendChild(headerMap.get(colId));
                    }
                });
            } catch (e) {
                console.error('Failed to load column order', e);
            }
        }
    }
}
