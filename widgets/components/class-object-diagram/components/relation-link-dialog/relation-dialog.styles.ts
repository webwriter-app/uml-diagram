import { css } from "lit";

/** Styles for the Relation Dialog */
export default css`

    /* -------------------------------------------------------------------------- */
    /* Dialog Panel                                                               */
    /* -------------------------------------------------------------------------- */

    /* Sets a fixed width with a maximum to ensure responsiveness */
    #relation-dialog::part(panel) {
        width: 800px;
        max-width: 90%;
        max-height: 100%;
    }

    /* Binds the dialog to the widget instead of the document */
    #relation-dialog::part(base) {
        position: absolute;
        height: 100%;
    }

    #relation-dialog::part(overlay) {
        position: absolute;
    }

    /* -------------------------------------------------------------------------- */
    /* Preview Section                                                            */
    /* -------------------------------------------------------------------------- */

    /* place the two class boxes and the connection line horizontally */
    .preview-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        margin-bottom: 20px;
        padding: 10px 0;
    }

    /* Displays the class name */
    .preview-box {
        width: 120px;
        min-height: 50px;
        border: 1px solid var(--sl-color-neutral-900);
        background-color: var(--sl-color-neutral-0);
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: var(--sl-font-size-small);
        line-height: 1.3;
        overflow-wrap: break-word;
        hyphens: auto;
    }

    /* styles the container for the connection line */
    .preview-connection {
        flex: 1;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Ensures the SVG fills its container and allows labels to overflow (important for arrow heads)*/
    .preview-connection svg {
        width: 100%;
        height: 100%;
        overflow: visible;
    }

    /* Styles the svg text labels in the preview */
    .preview-connection text {
        fill: black;
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        pointer-events: none;
    }

    /* -------------------------------------------------------------------------- */
    /* Footer Buttons                                                             */
    /* -------------------------------------------------------------------------- */

    /* Delete Button to the left and Safe to the right */
    .footer-container {
        display: flex;
        justify-content: space-between;
        width: 100%;
    }

    /* Applies a red border and background to invalid inputs */
    sl-input.has-error::part(base) {
        border-color: var(--sl-color-danger-500);
        background-color: var(--sl-color-danger-50);
    }
`;