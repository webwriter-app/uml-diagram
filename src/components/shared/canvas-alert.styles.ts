import { css } from "lit";

/**
 * Shared styles for the compact alerts at the bottom of the editor canvases:
 * hints while placing an element (e.g. "Select a lifeline") and error messages.
 */
export default css`

    /* Positioned via a wrapper, since sl-alert itself is display: contents */
    .canvas-alert {
        position: absolute;
        bottom: var(--sl-spacing-x-small);
        left: 50%;
        transform: translateX(-50%);
        z-index: 999;
        width: max-content;
        /* leaves room for the zoom controls (about 8rem wide) on both sides */
        max-width: calc(100% - 2 * (8rem + 2 * var(--sl-spacing-x-small)));
    }

    .canvas-alert sl-alert::part(base) {
        border-top-width: var(--sl-panel-border-width);
        border-top-color: var(--sl-panel-border-color);
        box-shadow: var(--sl-shadow-medium);
    }

    .canvas-alert sl-alert::part(icon) {
        font-size: var(--sl-font-size-medium);
        padding-inline-start: var(--sl-spacing-small);
    }

    .canvas-alert sl-alert::part(message) {
        padding: var(--sl-spacing-x-small) var(--sl-spacing-small);
    }

    .canvas-alert sl-alert::part(close-button) {
        padding-inline-end: var(--sl-spacing-2x-small);
    }

    .canvas-alert-text {
        white-space: pre-line;
    }
`;
