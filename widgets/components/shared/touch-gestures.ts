/** Distance between two fingers and their midpoint, in client coordinates */
export interface Pinch {
    distance: number;
    x: number;
    y: number;
}

export function measurePinch(a: { clientX: number, clientY: number }, b: { clientX: number, clientY: number }): Pinch {
    return {
        distance: Math.max(Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), 1),
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
    };
}

/** How far a finger may move (in px) during a tap or long press, and between the two taps of a double tap */
const TAP_SLOP = 10;
const DOUBLE_TAP_DISTANCE = 30;

/** How soon the second tap of a double tap must follow, when a press counts as long, and for how long the browser's own
 * dblclick or contextmenu is dropped after emulating one (in ms) */
const DOUBLE_TAP_DELAY = 350;
const LONG_PRESS_DURATION = 500;
const NATIVE_DUPLICATE_WINDOW = 1000;

/**
 * Dispatches a dblclick on double taps and a contextmenu on long presses with a finger or pen on `el`, like a double
 * or right click with the mouse. iOS Safari does neither for elements with `touch-action: none`.
 * Should the browser send its own dblclick or contextmenu for a touch as well, only the first of both counts.
 */
export function emulateTouchClicks(el: Element) {
    let press: { x: number, y: number, timer: number } | null = null;
    let lastTap: { x: number, y: number, time: number } | null = null;
    let lastEmitted = -Infinity;
    const on = (type: string, listener: (e: PointerEvent) => void) => el.addEventListener(type, listener as EventListener, true);

    const emit = (type: 'dblclick' | 'contextmenu', e: PointerEvent) => {
        lastEmitted = performance.now();
        // The pressed element may have been re-rendered since the finger went down, so look it up again
        const hit = (el.getRootNode() as Document | ShadowRoot).elementFromPoint(e.clientX, e.clientY);
        const target = hit && el.contains(hit) ? hit : e.target as Element;
        target.dispatchEvent(new MouseEvent(type, {
            bubbles: true, composed: true, cancelable: true, detail: type === 'dblclick' ? 2 : 0, button: type === 'contextmenu' ? 2 : 0,
            clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
        }));
    };

    const endPress = () => {
        if (press) clearTimeout(press.timer);
        press = null;
    };

    on('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        endPress();
        // A second finger makes this a pinch
        if (!e.isPrimary) {
            lastTap = null;
            return;
        }
        const timer = window.setTimeout(() => {
            press = null;
            lastTap = null;
            emit('contextmenu', e);
        }, LONG_PRESS_DURATION);
        press = { x: e.clientX, y: e.clientY, timer };
    });

    on('pointermove', (e) => {
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP) {
            endPress();
            lastTap = null;
        }
    });

    on('pointercancel', () => {
        endPress();
        lastTap = null;
    });

    on('pointerup', (e) => {
        if (e.pointerType === 'mouse') return;
        const wasTap = press !== null;
        endPress();
        // Not a tap: moved, held long (a long press) or part of a pinch
        if (!wasTap) {
            lastTap = null;
            return;
        }

        const tap = { x: e.clientX, y: e.clientY, time: e.timeStamp };
        if (!lastTap || tap.time - lastTap.time > DOUBLE_TAP_DELAY || Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) > DOUBLE_TAP_DISTANCE) {
            lastTap = tap;
            return;
        }
        lastTap = null;
        emit('dblclick', e);
    });

    for (const type of ['dblclick', 'contextmenu']) {
        el.addEventListener(type, (e) => {
            if (!e.isTrusted) return;
            if (performance.now() - lastEmitted < NATIVE_DUPLICATE_WINDOW) e.stopImmediatePropagation();
            // The browser was first (e.g. Android's shorter long press), so skip ours
            else endPress();
        }, true);
    }
}
