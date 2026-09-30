import { css } from "lit";

export default css`
    /* The diagram tabs form the top of the widget, the bordered frame below holds the diagrams */
    :host {
        /* Canvas color of the editors */
        --uml-canvas-background: var(--sl-color-neutral-0);

        display: block;
        height: 600px;
        position: relative;
        box-sizing: border-box;
    }

    /* Stacks the tabs and the frame; a separate element because the host's display
       is overridden by the editor */
    .root {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    /* The active tab overlaps the top border of the frame, so it has to be painted above it */
    diagram-tabs {
        position: relative;
        z-index: 1;
    }

    /* Bordered frame around toolbar and canvas */
    .frame {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-300);
        border-radius: var(--sl-border-radius-medium);
        overflow: hidden;
    }

    /* When the first tab is active it sits directly on the top left corner, so keep it square */
    .frame.first-tab-active {
        border-top-left-radius: 0;
    }

    /* Container for the diagram instances to ensure they take up the remaining space */
    .diagram-wrapper {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    /* hide settings menu if not in "edit mode" */
    :host(:not([contenteditable='true']):not([contenteditable=''])) global-settings-menu {
        display: none;
    }
`;
