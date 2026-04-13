import { css } from "lit";

export default css`
    :host {
        display: flex;
        flex-direction: column;
        height: 600px;
        position: relative;
        background: var(--sl-color-primary-50);
        border: 2px solid var(--sl-color-primary-900);
        border-radius: 4px;
        overflow: hidden;
    }

    /* Container for the diagram instances to ensure they take up the remaining space */
    .diagram-wrapper {
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    /* hide settings menu if not in "edit mode" */
    :host(:not([contenteditable='true']):not([contenteditable=''])) global-settings-menu {
        display: none;
    }
`;