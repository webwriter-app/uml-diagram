/**
 * Calls `cancel` on Escape, on pointer presses or focus outside of `host` and when the window loses focus.
 * Used to end selection modes (e.g. picking the classes of a new relation). Escape is kept from reaching other
 * handlers (e.g. WebWriter's) while listening. Returns a controller whose `abort()` removes the listeners again.
 */
export function cancelOnOutsideInteraction(host: HTMLElement, cancel: () => void): AbortController {
    const controller = new AbortController();
    const { signal } = controller;
    const doc = host.ownerDocument;
    const isOutside = (e: Event) => !e.composedPath().includes(host);

    doc.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
        }
    }, { capture: true, signal });
    doc.addEventListener('pointerdown', (e) => isOutside(e) && cancel(), { capture: true, signal });
    doc.addEventListener('focusin', (e) => isOutside(e) && cancel(), { signal });
    doc.defaultView?.addEventListener('blur', () => cancel(), { signal });

    return controller;
}
