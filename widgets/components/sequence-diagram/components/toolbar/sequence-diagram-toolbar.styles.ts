import { css } from "lit";

/** Styles for the Sequence Diagram Container. */
export default css`
    /* Lays out the main toolbar horizontally, distributing space between the left and right sections, and adds a subtle bottom border for separation. */
    .toolbar-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        gap: 8px;
        background-color: var(--sl-color-primary-100);
        border-bottom: 1px solid var(--sl-color-primary-900);
        font-family: var(--sl-font-sans, system-ui, sans-serif);
        font-size: var(--sl-font-size-medium, 14px);
    }

    .center-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Defines how the buttons in the toolbar are looking */
    .left-section .toolbar-btn::part(base),
    .center-section .toolbar-btn::part(base) {
        color: var(--sl-color-neutral-900);
        font-weight: 500;
        border: 1px solid var(--sl-color-primary-900);
        background-color: var(--sl-color-primary-50);
        min-width: 110px;
        justify-content: center;
    }

    .left-section .toolbar-btn::part(base):hover,
    .center-section .toolbar-btn::part(base):hover {
        color: var(--sl-color-neutral-900);
        background-color: var(--sl-color-primary-100);
    }

    /* Defines Background color for the dropdown menus*/
    .toolbar-menu::part(base) {
        background-color: var(--sl-color-primary-50);
        padding: 0;
    }

    .toolbar-menu .toolbar-menu-item::part(base) {
        background-color: var(--sl-color-primary-50);
    }

    .toolbar-menu .toolbar-menu-item::part(base):hover {
        background-color: var(--sl-color-primary-100);
    }

    .toolbar-divider::part(base) {
        background-color: var(--sl-color-primary-50);
    }

    .toolbar-menu {
        --sl-panel-background-color: var(--sl-color-primary-50);
    }

    /** Color of the clear bin */
    .clear-btn::part(base) {
        color: var(--sl-color-neutral-900);
    }

    /* Applies a red warning text and light red background to the clear button on hover to visually emphasize its destructive action. */
    .clear-btn::part(base):hover {
        color: var(--sl-color-danger-600);
        background-color: var(--sl-color-danger-50);
    }

    /* defines whre the tooltip is displayed */
    sl-tooltip {
        display: inline-block;
    }

    /* defines the visual of the tooltip */
    sl-tooltip::part(body) {
        background-color: var(--sl-color-primary-900);
        color: var(--sl-color-primary-50);
        font-size: var(--sl-font-size-x-small);
        font-family: var(--sl-font-sans);
        border-radius: 4px;
        padding: 4px 8px;
    }

    sl-tooltip::part(base__arrow) {
        background-color: var(--sl-color-primary-900);
    }

    /* Centers the sequence exclucive buttons in fullscreen mode */
    .toolbar-container.fullscreen {
        position: relative;
    }

    .toolbar-container.fullscreen .center-section {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }
  
`;