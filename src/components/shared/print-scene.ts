import type { Viewport, WorldBox } from "@webwriter/lit/viewport";

/**
 * Before printing the view is fitted to the whole diagram and put back afterwards. A WebGL canvas can print blank, because the browser may have cleared its drawing buffer by then. Before printing, the scenes
 * of the element draw once more and a copy on an ordinary canvas takes the place of the WebGL one; after printing it is removed.
 * Scenes that draw with SVG have no canvas and are left alone. The listeners go with the signal.
 */
/** The box of everything that is drawn on the scenes of the element, in world coordinates */
function diagramBox(element: HTMLElement, viewport: Pick<Viewport, "toWorld">): WorldBox | undefined {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const scene of element.shadowRoot?.querySelectorAll("ww-scene") ?? []) {
        for (const child of scene.children) {
            const rect = child.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            const from = viewport.toWorld(rect.left, rect.top);
            const to = viewport.toWorld(rect.right, rect.bottom);
            left = Math.min(left, from.x); top = Math.min(top, from.y);
            right = Math.max(right, to.x); bottom = Math.max(bottom, to.y);
        }
    }
    return left < right && top < bottom ? { x: left, y: top, width: right - left, height: bottom - top } : undefined;
}

export function printWebglScenes(element: HTMLElement, signal: AbortSignal, viewport?: Pick<Viewport, "x" | "y" | "scale" | "min" | "max" | "width" | "height" | "setView" | "toWorld">) {
    let view: { x: number; y: number; scale: number } | undefined;

    let copies: { original: HTMLCanvasElement; copy: HTMLCanvasElement; display: string }[] = [];

    const restore = () => {
        if (view) viewport?.setView(view, { animate: false });
        view = undefined;
        for (const { original, copy, display } of copies) {
            copy.remove();
            original.style.display = display;
        }
        copies = [];
    };

    const copyCanvases = () => {
        restore();
        // The whole diagram goes on the page, not only the part that is on screen
        if (viewport) {
            view = { x: viewport.x, y: viewport.y, scale: viewport.scale };
            const box = diagramBox(element, viewport);
            if (box && viewport.width && viewport.height) {
                const margin = 16;
                const scale = Math.max(viewport.min, Math.min(viewport.max, 1, (viewport.width - 2 * margin) / box.width, (viewport.height - 2 * margin) / box.height));
                void viewport.setView({ x: margin - box.x * scale, y: margin - box.y * scale, scale }, { animate: false });
            }
        }
        for (const scene of element.shadowRoot?.querySelectorAll<HTMLElement & { render?: () => boolean }>("ww-scene") ?? []) {
            const original = scene.shadowRoot?.querySelector("canvas");
            if (!original || !original.width || !original.height) continue;
            // Only a canvas that is shown and was drawn gets a copy
            if (!scene.render?.()) continue;
            const copy = Object.assign(document.createElement("canvas"), { width: original.width, height: original.height });
            const context = copy.getContext("2d");
            if (!context) continue;
            context.drawImage(original, 0, 0);
            copy.style.cssText = original.style.cssText;
            copy.className = original.className;
            copy.setAttribute("part", "drawing");
            copies.push({ original, copy, display: original.style.display });
            original.after(copy);
            original.style.display = "none";
        }
    };

    // Some print paths (saving a PDF) change the media without the print events
    const media = window.matchMedia("print");
    const onMedia = () => (media.matches ? copyCanvases() : restore());
    window.addEventListener("beforeprint", copyCanvases, { signal });
    window.addEventListener("afterprint", restore, { signal });
    media.addEventListener("change", onMedia, { signal });
    signal.addEventListener("abort", restore);
}
