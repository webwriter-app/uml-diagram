import { css } from "lit";

/**
 * Styles for the Class and Object Diagram Toolbar component.
 * The general toolbar layout is defined in the shared toolbar styles.
 */
export default css`

    /* deactivate toolbar when dialog is open */
    :host([dialogopen]) {
        pointer-events: none;
        opacity: 0.5;
    }
`;
