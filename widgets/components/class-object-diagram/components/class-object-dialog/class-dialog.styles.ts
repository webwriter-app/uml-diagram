import { css } from "lit";

/** Styles for the Class and Object Dialog component */
export default css`

    /* -------------------------------------------------------------------------- */
    /* Dialog Panel                                                               */
    /* -------------------------------------------------------------------------- */

    /* Sets a fixed width with a maximum */
    #edit-dialog::part(panel) {
        width: 800px;
        max-width: 90%;
        max-height: 100%;
    }

    /* Binds the dialog to the widget instead of the document */
    #edit-dialog::part(base) {
        position: absolute;
        height: 100%;
    }

    #edit-dialog::part(overlay) {
        position: absolute;
    }

    /* -------------------------------------------------------------------------- */
    /* Form Layout & Sections                                                     */
    /* -------------------------------------------------------------------------- */

    /* Stacks attributes, methods vertically */
    .dialog-section {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 5px;
    }

    /* places the type selector input controls */
    #edit-type::part(form-control-input) {
        display: flex;
        flex-direction: row;
        gap: var(--sl-spacing-large);
    }

    /* -------------------------------------------------------------------------- */
    /* Attribute, Method and Parameter Cards                                      */
    /* -------------------------------------------------------------------------- */

    /* layout for attribute and method entries */
    .method-or-parameter-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border: 1px solid var(--sl-color-neutral-200);
        padding: 12px;
        border-radius: var(--sl-border-radius-medium);
        background-color: var(--sl-color-neutral-50);
    }

    /* subsection for method parameters */
    .parameter-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: var(--sl-color-neutral-0);
        border: 1px dashed var(--sl-color-neutral-300);
        border-radius: var(--sl-border-radius-small);
        margin-left: 20px;
    }

    /* -------------------------------------------------------------------------- */
    /* Validation & Error States                                                  */
    /* -------------------------------------------------------------------------- */

    /* Applies a red border and background to invalid input and select fields */
    sl-input.has-error::part(base),
    sl-select.has-error::part(combobox) {
        border-color: var(--sl-color-danger-500);
        background-color: var(--sl-color-danger-50);
    }

    /* Colors the help text to highlight validation errors */
    sl-input.has-error::part(help-text) {
        color: var(--sl-color-danger-600);
    }

    /* Colors icons inside invalid inputs */
    sl-input.has-error sl-icon {
        color: var(--sl-color-danger-500);
    }

    /* -------------------------------------------------------------------------- */
    /* Footer Buttons                                                             */
    /* -------------------------------------------------------------------------- */

    /* delete button to the left and save button to the right */
    .footer-container {
        display: flex;
        justify-content: space-between;
        width: 100%;
    }
`;