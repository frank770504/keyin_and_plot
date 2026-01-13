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
