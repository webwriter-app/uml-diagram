import { css } from "lit";

/** Styles for the Class and Object Diagram Container */
export default css`

    /* -------------------------------------------------------------------------- */
    /* Host Container                                                             */
    /* -------------------------------------------------------------------------- */

    /* Stacks the toolbar and editor vertically and fills the available space */
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        position: relative;
    }

    /* -------------------------------------------------------------------------- */
    /* Editor Wrapper                                                             */
    /* -------------------------------------------------------------------------- */

    /* Fills the remaining space below the toolbar and clips overflowing content */
    .editor-wrapper {
        flex: 1;
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    /* puts the toolbar on a higher "layer" so that the toolbar (incl tooltips) are over the editor */
    class-toolbar {
        position: relative;
        z-index: 10;
    }
`;