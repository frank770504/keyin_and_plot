/**
 * Global Notification and Error Handling System
 */

const elements = {
    dialog: document.getElementById('notification-dialog'),
    header: document.getElementById('notification-header'),
    message: document.getElementById('notification-message')
};

/**
 * Show a custom notification dialog
 * @param {string} message - The message to display
 * @param {string} severity - 'error', 'warning', 'success', 'info' (default: 'warning')
 */
export function showNotification(message, severity = 'warning') {
    if (!elements.dialog) return;

    // Reset classes
    elements.dialog.classList.remove('severity-error', 'severity-warning', 'severity-success', 'severity-info');
    elements.dialog.classList.add(`severity-${severity}`);

    // Set content
    elements.header.textContent = severity.charAt(0).toUpperCase() + severity.slice(1);
    elements.message.textContent = message;

    // Show dialog
    if (!elements.dialog.open) {
        elements.dialog.showModal();
    }
}

/**
 * Initialize global error handling and monkey-patch window.alert
 */
export function initNotifications() {
    // 1. Monkey-patch window.alert
    const originalAlert = window.alert;
    window.alert = (msg) => {
        console.warn('Native alert() intercepted:', msg);
        showNotification(msg, 'warning');
    };

    // 2. Catch unhandled runtime errors
    window.onerror = function(message, source, lineno, colno, error) {
        const errorMsg = error ? error.message : message;
        console.error('Global Error Caught:', errorMsg, { source, lineno, colno });
        showNotification(`System Error: ${errorMsg}`, 'error');
        return false; // Let browser still log it to console
    };

    // 3. Catch unhandled promise rejections
    window.onunhandledrejection = function(event) {
        console.error('Unhandled Promise Rejection:', event.reason);
        const reason = event.reason?.message || event.reason || 'Unknown async error';
        showNotification(`Async Error: ${reason}`, 'error');
    };
}

/**
 * Specifically handles the "Unsaved Changes" workflow.
 * Returns a promise that resolves to 'save', 'discard', or 'stay'.
 */
export function showUnsavedChangesDialog() {
    const dialog = document.getElementById('unsaved-changes-dialog');
    if (!dialog) return Promise.resolve('discard'); // Fallback

    return new Promise((resolve) => {
        const handleClose = () => {
            dialog.removeEventListener('close', handleClose);
            resolve(dialog.returnValue || 'stay');
        };
        dialog.addEventListener('close', handleClose);
        dialog.showModal();
    });
}
