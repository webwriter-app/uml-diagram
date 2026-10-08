import { css } from "lit";
/**
 * Styles for the Zoom Controls component.
 * Floating panel in the bottom-right corner of the editor canvas, sized and bordered
 * like the small buttons in the toolbar.
 */
export default css`

    :host {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        position: absolute;
        bottom: var(--sl-spacing-x-small);
        right: var(--sl-spacing-x-small);
        z-index: 10;
        height: var(--sl-input-height-small);
        padding: 0 var(--sl-spacing-3x-small);

        background-color: rgba(255, 255, 255, 0.9);
        border: var(--sl-input-border-width) solid var(--sl-input-border-color);
        border-radius: var(--sl-input-border-radius-small);

        color: var(--sl-color-neutral-700);
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-medium);
        -webkit-user-select: none;
        user-select: none;
    }

    sl-icon-button::part(base) {
        padding: var(--sl-spacing-2x-small);
    }

    .zoom-level {
        min-width: 2.5rem;
        text-align: center;
        font-size: var(--sl-font-size-x-small);
        font-variant-numeric: tabular-nums;
        color: var(--sl-color-neutral-600);
    }

    sl-divider {
        height: 1rem;
        --spacing: var(--sl-spacing-2x-small);
    }
`;
