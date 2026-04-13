import { css } from "lit";

/**
 * Styles for the Class and Object Diagram Toolbar component.
 * Defines the layout of the toolbar (button styling, dropdown menu styling)
 */
export default css`

    /* -------------------------------------------------------------------------- */
    /* Toolbar Container                                                          */
    /* -------------------------------------------------------------------------- */

    /* Main toolbar layout: space between sections */
    .toolbar-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        gap: 8px;
        background-color: var(--sl-color-primary-100);
        border-bottom: 2px solid var(--sl-color-primary-900);
        user-select: none;
        font-family: var(--sl-font-sans, system-ui, sans-serif);
        font-size: var(--sl-font-size-medium, 14px);
    }

    /* Left section holds the diagram switcher dropdown */
    .toolbar-container .left-section {
        display: flex;
        align-items: center;
    }

    /* center section holds the diagram specific buttons to add elements */
    .center-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Right section holds the clear button */
    .toolbar-container .right-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Centers the center section buttons in fullscreen mode */
    .toolbar-container.fullscreen {
        position: relative;
    }

    .toolbar-container.fullscreen .center-section {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }

    /* deactivate toolbar when dialog is open */
    :host([dialogopen]) {
        pointer-events: none;
        opacity: 0.5;
    }

    /* -------------------------------------------------------------------------- */
    /* Toolbar Buttons                                                            */
    /* -------------------------------------------------------------------------- */

    /* Applies styling to all toolbar buttons */
    .toolbar-btn::part(base) {
        color: var(--sl-color-neutral-900);
        font-weight: 500;
        border: 1px solid var(--sl-color-primary-900);
        background-color: var(--sl-color-primary-50);
        min-width: 110px;
        justify-content: center;
    }

    /* highlight the button background on hover */
    .toolbar-btn::part(base):hover {
        color: var(--sl-color-neutral-900);
        background-color: var(--sl-color-primary-100);
    }

    /* -------------------------------------------------------------------------- */
    /* Dropdown Menus                                                             */
    /* -------------------------------------------------------------------------- */

    /* Overrides the Shoelace panel background color */
    .toolbar-menu {
        --sl-panel-background-color: var(--sl-color-primary-50);
    }

    /* Removes default padding and sets background color for the menu panel */
    .toolbar-menu::part(base) {
        background-color: var(--sl-color-primary-50);
        padding: 0;
    }

    /* Sets background color for individual menu items */
    .toolbar-menu .toolbar-menu-item::part(base) {
        background-color: var(--sl-color-primary-50);
    }

    /* highlight the background on hover */
    .toolbar-menu .toolbar-menu-item::part(base):hover {
        background-color: var(--sl-color-primary-100);
    }

    /* Styles the menu section labels */
    .toolbar-menu-label::part(base) {
        color: var(--sl-color-neutral-900);
        font-weight: bold;
        font-size: var(--sl-font-size-medium);
        padding-top: var(--sl-spacing-x-small);
    }

    /* Matches the divider color to the menu background */
    .toolbar-divider::part(base) {
        background-color: var(--sl-color-primary-50);
    }

    /* -------------------------------------------------------------------------- */
    /* Clear Button                                                               */
    /* -------------------------------------------------------------------------- */

    /* Sets the icon color to match other toolbar buttons */
    .clear-btn::part(base) {
        color: var(--sl-color-neutral-900);
    }

    /* Applies a red warning color on hover */
    .clear-btn::part(base):hover {
        color: var(--sl-color-danger-600);
        background-color: var(--sl-color-danger-50);
    }

    /* -------------------------------------------------------------------------- */
    /* Tooltip for hovering over disabled buttons                                 */
    /* -------------------------------------------------------------------------- */

    sl-tooltip {
        display: inline-block;
    }

    sl-tooltip::part(body) {
        background-color: var(--sl-color-primary-900);
        color: var(--sl-color-primary-50);
        font-size: var(--sl-font-size-x-small);
        font-family: var(--sl-font-sans);
        border-radius: 4px;
        padding: 4px 8px;
        z-index: 9999;
    }

    sl-tooltip::part(base) {
        z-index: 9999;
    }

    sl-tooltip::part(base__popup) {
        z-index: 9999;
    }

    sl-tooltip::part(base__arrow) {
        background-color: var(--sl-color-primary-900);
    }
`;