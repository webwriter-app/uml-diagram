import { css } from "lit";
/**
 * Styles for the Global Settings Menu component.
 * Defines the layout of the settings sidebar shown in the authoring view.
 * Uses a tab-based layout to separate the different settings
 */
export default css`

    /* Stacks all content vertically and inherits the widget font */
    :host {
        display: flex;
        flex-direction: column;
        font-family: var(--sl-font-sans);
    }

    /* -------------------------------------------------------------------------- */
    /* Tab Group                                                                  */
    /* -------------------------------------------------------------------------- */

    /* Removes the active tab indicator track */
    sl-tab-group {
        --track-width: 0px;
    }

    /* Arranges tabs and panels in a vertical column */
    sl-tab-group::part(base) {
        display: flex;
        flex-direction: column;
    }

    /* Styles the tab navigation bar to match the toolbar appearance */
    sl-tab-group::part(nav) {
        background-color: var(--sl-color-primary-100);
        border-top: 2px solid var(--sl-color-primary-900);
        border-bottom: 2px solid var(--sl-color-primary-900);
        border-right: 2px solid var(--sl-color-primary-900);
        border-left: 2px solid var(--sl-color-primary-900);
        padding: 0;
    }

    /* -------------------------------------------------------------------------- */
    /* Tab Styling                                                                */
    /* -------------------------------------------------------------------------- */

    /* Reduces tab padding and font size for a compact appearance */
    sl-tab::part(base) {
        padding: 4px 5px;
        font-size: var(--sl-font-size-small);
        color: var(--sl-color-neutral-700);
    }

    /* Highlights the tab on hover */
    sl-tab::part(base):hover {
        color: var(--sl-color-neutral-900);
        background-color: var(--sl-color-primary-200);
    }

    /* Marks the active tab with a stronger text weight */
    sl-tab[active]::part(base) {
        color: var(--sl-color-neutral-900);
        font-weight: 500;
        background-color: var(--sl-color-primary-200);
    }

    /* -------------------------------------------------------------------------- */
    /* Tab Panel                                                                  */
    /* -------------------------------------------------------------------------- */

    /* Adds consistent padding inside each tab panel */
    sl-tab-panel::part(base) {
        padding: 8px 4px;
        border: 2px solid var(--sl-color-primary-900);
        border-top: none;
    }

    /* -------------------------------------------------------------------------- */
    /* Inner Content Layout                                                       */
    /* -------------------------------------------------------------------------- */

    /* Stacks global switch buttons and the validation selector vertically */
    .global-settings-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 4px 8px;
    }
`;