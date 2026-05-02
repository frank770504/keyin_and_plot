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
            th.draggable = true;
            th.classList.add('draggable-header');

            th.addEventListener('dragstart', (e) => this.dragStart(e, th));
            th.addEventListener('dragover', (e) => this.dragOver(e, th));
            th.addEventListener('drop', (e) => this.drop(e, th));
            th.addEventListener('dragend', () => this.dragEnd());
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
