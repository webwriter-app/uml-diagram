import { css } from "lit";

/** Styles for the Sequence Diagram Container. */
export default css`
    /* Sets up the main container to take up full space and use a vertical flex layout. */
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        position: relative;
    }
    
    /* Allows the editor to fill all remaining vertical space while preventing overflow. */
    .sequence-editor-wrapper {
        flex: 1;
        display: block;
        overflow: hidden;
    }

    /* puts the toolbar on a higher "layer" so that the toolbar (incl tooltips) are over the editor */
    sequence-toolbar {
        position: relative;
        z-index: 10;
    }
  
`;