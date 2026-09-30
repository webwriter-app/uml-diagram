import { css } from "lit";
/**
 * Styles for the Diagram Tabs component.
 * The tabs form the top of the widget above the bordered frame. Inactive tabs look like
 * text buttons; the active tab is a folder tab that cuts into the top border of the frame
 * and merges with the toolbar row below.
 */
export default css`

    /* Tab row on top of the widget; the frame below provides the border line */
    :host {
        display: flex;
        align-items: flex-end;
        gap: var(--sl-spacing-3x-small);
    }

    /* Inactive tabs look like small Shoelace text buttons without an outline */
    .tab {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        height: var(--sl-input-height-small);
        padding: 0 var(--sl-spacing-medium);
        min-width: 5rem;

        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        font-weight: var(--sl-font-weight-semibold);
        color: var(--sl-color-neutral-600);
        white-space: nowrap;

        background: none;
        /* transparent border keeps the size identical to the bordered active tab */
        border: var(--sl-input-border-width) solid transparent;
        border-bottom: none;
        border-radius: var(--sl-input-border-radius-small) var(--sl-input-border-radius-small) 0 0;
        cursor: pointer;
        transition: var(--sl-transition-fast) color;
    }

    .tab:hover:not(.active) {
        color: var(--sl-color-primary-500);
    }

    .tab:focus-visible {
        outline: var(--sl-focus-ring);
        outline-offset: calc(-1 * var(--sl-focus-ring-width));
    }

    /* The active tab reaches down through the frame border, is filled with the toolbar
       color so it merges with the toolbar row below and is highlighted in the primary color */
    .tab.active {
        color: var(--sl-color-primary-600);
        background-color: var(--sl-color-neutral-0);
        border-color: var(--sl-input-border-color);
        height: calc(var(--sl-input-height-small) + 1px);
        margin-bottom: -1px;
        padding-bottom: 1px;
        cursor: default;
    }
`;
