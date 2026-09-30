import { css } from "lit";
/**
 * Styles for the Zoom Controls component.
 * Floating panel in the top-right corner of the editor canvas.
 */
export default css`

    /* Floating panel in the top-right corner of the canvas */
    :host {
        display: flex;
        align-items: center;
        position: absolute;
        top: var(--sl-spacing-medium);
        right: var(--sl-spacing-medium);
        z-index: 10;
        padding: var(--sl-spacing-3x-small);

        background-color: rgba(255, 255, 255, 0.9);
        border: var(--sl-panel-border-width) solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-large);

        color: var(--sl-color-neutral-700);
        font-size: var(--sl-font-size-large);
        -webkit-user-select: none;
        user-select: none;
    }

    .zoom-level {
        min-width: 3rem;
        text-align: center;
        font-size: var(--sl-font-size-small);
        font-variant-numeric: tabular-nums;
        color: var(--sl-color-neutral-600);
    }

    sl-divider {
        height: 1.25rem;
        --spacing: var(--sl-spacing-2x-small);
    }
`;
