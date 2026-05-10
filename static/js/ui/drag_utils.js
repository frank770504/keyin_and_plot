// static/js/ui/drag_utils.js

/**
 * Shared utility for dragging elements with viewport boundary clamping.
 * Ensures that a clickable portion of the handle remains within the viewport.
 */
export function enableDragging(element, handle, options = {}) {
    const padding = options.padding || 30; // Min pixels of handle to keep on screen
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        // Don't drag if clicking buttons inside header
        if (e.target.closest('button') || e.target.closest('input')) return;
        
        e.preventDefault();
        // Get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
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

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const offsetParent = element.offsetParent || document.body;
        const offsetParentRect = offsetParent.getBoundingClientRect();

        if (options.containment === 'parent') {
            // Option: Container Clamping (Stay inside right pane)
            const parentWidth = offsetParent.clientWidth;
            const parentHeight = offsetParent.clientHeight;

            // Simple local coordinate clamping
            if (newTop < 0) newTop = 0;
            if (newTop > parentHeight - padding) newTop = parentHeight - padding;
            if (newLeft < 0) newLeft = 0;
            if (newLeft > parentWidth - padding) newLeft = parentWidth - padding;

            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
        } else {
            // Option 2: Viewport Clamping (Handle Preservation)
            // Convert local newTop/newLeft to viewport-relative for clamping
            let viewTop = newTop + offsetParentRect.top;
            let viewLeft = newLeft + offsetParentRect.left;

            // Clamp Top: Header must not go above top or too far below
            if (viewTop < 0) viewTop = 0;
            if (viewTop > viewportHeight - padding) viewTop = viewportHeight - padding;

            // Clamp Left: At least 'padding' pixels of width must be visible
            if (viewLeft < padding - rect.width) viewLeft = padding - rect.width;
            if (viewLeft > viewportWidth - padding) viewLeft = viewportWidth - padding;

            // Convert back to offsetParent-relative
            element.style.top = (viewTop - offsetParentRect.top) + "px";
            element.style.left = (viewLeft - offsetParentRect.left) + "px";
        }
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

/**
 * Shared utility for resizing elements.
 * Supports 'bottom-right' and 'bottom-left' directions.
 */
export function enableResizing(element, handle, direction) {
    let startWidth, startHeight, startX, startY, startLeft;

    handle.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;

        document.onmousemove = doResize;
        document.onmouseup = stopResize;
    };

    function doResize(e) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        if (direction === 'bottom-right') {
            element.style.width = (startWidth + deltaX) + 'px';
            element.style.height = (startHeight + deltaY) + 'px';
        } else if (direction === 'bottom-left') {
            const newWidth = startWidth - deltaX;
            if (newWidth > 100) { // Min width constraint
                element.style.width = newWidth + 'px';
                element.style.left = (startLeft + deltaX) + 'px';
            }
            element.style.height = (startHeight + deltaY) + 'px';
        }
    }

    function stopResize() {
        document.onmousemove = null;
        document.onmouseup = null;
    }
}
