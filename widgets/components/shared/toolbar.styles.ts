import { css } from "lit";
/**
 * Shared styles for the diagram toolbars.
 * Layout: a row of diagram tabs on top, below it the toolbar row with the add buttons
 * on the left and the reset button on the right. Uses Shoelace defaults for buttons, menus and tooltips.
 */
export default css`

    :host {
        display: block;
    }

    /* Toolbar row below the diagram tabs */
    .toolbar-container {
        display: flex;
        align-items: center;
        gap: var(--sl-spacing-medium);
        padding: var(--sl-spacing-x-small);
        background-color: var(--sl-color-neutral-0);
        border-bottom: 1px solid var(--sl-color-neutral-300);
        font-family: var(--sl-font-sans);
        -webkit-user-select: none;
        user-select: none;
    }

    /* Add buttons; they take the free space so the reset button sits on the right */
    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--sl-spacing-x-small);
        flex: 1;
    }

    sl-tooltip {
        /* Fix dropdown position when using button with tooltip as dropdown trigger
           See https://github.com/shoelace-style/shoelace/discussions/1961 */
        display: inline-block;
    }

    sl-button::part(label) {
        display: flex;
        align-items: center;
    }

    sl-button sl-icon {
        font-size: var(--sl-font-size-medium);
    }

    sl-menu-item::part(base) {
        align-items: center;
    }

    /* Dividers separate menu groups; hide one that ends up first because the groups before it are disabled */
    sl-menu > sl-divider:first-child {
        display: none;
    }

`;
