import { css } from "lit";

/**
 * Styles for the Class and Object Diagram Settings Menu
 * Defines the layout of the configuration sidebar
 */
export default css`

    /* -------------------------------------------------------------------------- */
    /* Host Container                                                             */
    /* -------------------------------------------------------------------------- */

    /* Stacks all settings sections vertically with a small spacing */
    :host {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 5px;
        font-family: var(--sl-font-sans);
    }

    /* -------------------------------------------------------------------------- */
    /* sl-details accordion Styling                                             */
    /* -------------------------------------------------------------------------- */

    /* Removes default border and background from sl-details */
    sl-details {
        border: none;
        background: transparent;
        margin-bottom: 0px;
    }

    /* Modifier class for grouped options with a transparent border and no padding */
    sl-details.options-group {
        border: 1px solid transparent;
        border-radius: 5px;
        background-color: transparent;
        padding: 0px;
    }

    /* Removes the default border and background from the inner base part */
    sl-details::part(base) {
        border: none;
        background-color: transparent;
    }

    /* Reduces the header height and padding */
    sl-details::part(header) {
        padding: 2px 2px;
        min-height: 25px;
    }

    /* Highlights the header if open */
    sl-details[open]::part(header) {
        background-color: var(--sl-color-neutral-200);
        border-radius: 4px;
    }

    /* Highlights the header row on hover */
    sl-details::part(header):hover {
        background-color: var(--sl-color-neutral-200);
        border-radius: 4px;
    }

    /* Reduces font size and weight of the details label */
    sl-details::part(summary) {
        font-weight: normal;
        font-size: var(--sl-font-size-small);
    }

    /* Reduces the size of the expand icon */
    sl-details::part(summary-icon) {
        font-size: var(--sl-font-size-x-small);
        margin-right: 5px;
    }

    /* Adds left padding to the expanded content for visual hierarchy */
    sl-details::part(content) {
        padding: 2px 0 2px 12px;
    }

    /* -------------------------------------------------------------------------- */
    /* Inner Content Layout                                                       */
    /* -------------------------------------------------------------------------- */

    /* Stacks switch options vertically */
    .options-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 10px;
        padding-bottom: 5px;
    }

    /* defines where to show the tooltip */
    sl-tooltip {
        display: block;
        width: 100%;
        --max-width: 220px;
    }

    /* defines the looks of the tooltip */
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
`;