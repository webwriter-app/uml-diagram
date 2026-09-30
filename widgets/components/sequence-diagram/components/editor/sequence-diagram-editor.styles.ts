import { css } from "lit";

/** Styles for the Sequence Diagram Container. */
export default css`
    /** Defines the main editor area, applying a full-size layout with a dotted grid background that follows panning and zooming (grid variables are set by the editor). */
    :host {
        display: block;
        width: 100%;
        height: 100%;
        background-color: var(--uml-canvas-background, var(--sl-color-neutral-0));
        background-image: radial-gradient(circle, var(--sl-color-neutral-300) 1px, transparent 1px);
        background-size: var(--grid-size, 40px) var(--grid-size, 40px);
        background-position: var(--grid-x, 0) var(--grid-y, 0);
        overflow: hidden;
        position: relative;
    }

    /* Ensures the SVG canvas fills its container and disables default touch actions to allow custom drag interactions. */
    svg {
        width: 100%;
        height: 100%;
        touch-action: none;
    }

    /* Change the cursor while 'moving' the whole diagram view */
    svg:active {
        cursor: move;
    }

    /* The empty canvas cannot be panned */
    svg.empty:active {
        cursor: default;
    }

    /* Hint in the center of an empty canvas, pointing to the toolbar */
    .empty-hint {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--sl-spacing-large);
        box-sizing: border-box;
        text-align: center;
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        color: var(--sl-color-neutral-500);
        -webkit-user-select: none;
        user-select: none;
        pointer-events: none;
    }

    /* Styles the visual representation of the lifeline as a dashed line and disables pointer events so clicks pass through to the hitbox. */
    .lifeline-line {
        stroke: var(--sl-color-neutral-900);
        stroke-width: 2.5px;
        stroke-dasharray: 8, 8;
        pointer-events: none;
    }

    /* Styles the resize handle at the bottom of the lifeline, keeping it hidden by default with a smooth fade-in transition. */
    .lifeline-handle {
        fill: var(--sl-color-neutral-500);
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    /* Reveals the resize handle by making it semi-transparent when hovering over the lifeline. */
    .lifeline:hover .lifeline-handle {
        opacity: 0.5;
    }

    /* Creates an invisible, interactive area over the lifeline with a smooth transition for background color changes. */
    .lifeline-click-area {
        fill: transparent;
        transition: fill 0.2s ease;
    }

    /* Highlights the lifeline's clickable area with a subtle gray fill when hovered. */
    /*.lifeline-click-area:hover {
        fill: var(--sl-color-neutral-200); 
    }*/ 
    
    .lifeline:hover .lifeline-click-area {
        fill: var(--sl-color-neutral-200); 
    }

    /* Applies a light blue highlight and pointer cursor to lifelines only when actively selecting a message source or target. */
    /*:host([interactionMode="add-message-source"]) .lifeline-click-area:hover,
    :host([interactionMode="add-message-target"]) .lifeline-click-area:hover {
        fill: var(--sl-color-primary-100); 
        cursor: pointer;
    }*/ 
    
    :host([interactionMode="add-message-source"]) .lifeline:hover .lifeline-click-area,
    :host([interactionMode="add-message-target"]) .lifeline:hover .lifeline-click-area {
        fill: var(--sl-color-primary-100); 
        cursor: pointer;
    }

    /* Visually emphasizes the lifeline that has been selected as the starting point for a new message. */
    .lifeline-click-area.selected-source {
        fill: var(--sl-color-primary-100);
    }

    /* Styles the floating instruction banner centered at the top of the editor to guide the user during specific interactions. */
    .interaction-banner {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 20px;
        background-color: var(--sl-color-primary-700);
        color: var(--sl-color-neutral-0);
        border-radius: var(--sl-border-radius-pill);
        box-shadow: var(--sl-shadow-large);
        font-size: var(--sl-font-size-small);
        font-family: var(--sl-font-sans);
        pointer-events: auto;
        border: 1px solid var(--sl-color-primary-900);
    }

    /* Defines the visual appearance of the solid line connecting lifelines for a message. */
    .message-line {
        stroke: var(--sl-color-neutral-900);
        stroke-width: 1.5px;
    }

    /* Styles the message text label, centering it and disabling selection/pointer events so it doesn't block interactions. */
    .message-text {
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        text-anchor: middle;
        user-select: none;
        pointer-events: none; 
    }

    /* Creates a thick, invisible bounding box around the message line to make it much easier to click and drag. */
    .message-hitbox {
        stroke: transparent;
        stroke-width: 20px;
        fill: none;
        transition: stroke 0.2s ease;
    }

    /* Highlights the message's invisible hitbox with a subtle gray bar when hovered, indicating it can be interacted with. */
    .message:hover .message-hitbox {
        stroke: var(--sl-color-neutral-200);
    }

    /* Adds a smooth transition and a solid light gray hover effect to the activation box, providing interactive feedback without letting the dashed lifeline show through. */
    .activation-box {
        transition: fill 0.2s ease;
    }

    .activation:hover .activation-box {
        fill: var(--sl-color-neutral-200);
    }

    /* Adds a smooth transition and a light gray hover effect to the fragment's header hitbox, clearly indicating the draggable area. */
    .fragment-header-hitbox {
        transition: fill 0.2s ease;
    }

    .fragment:hover .fragment-header-hitbox {
        fill: var(--sl-color-neutral-200);
    }

    /* Styles the lifeline's header box, using flexbox to center the content and ensuring long names wrap properly without overflowing the borders. */
    .lifeline-box-html {
        width: 100%;
        height: 100%;
        background-color: var(--sl-color-neutral-0);
        border: 2px solid var(--sl-color-neutral-900);
        border-radius: 4px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-medium);
        font-weight: bold;
        padding: 4px;
        overflow-wrap: break-word;
        word-break: break-word;
        line-height: 1.2;
    }

    /* Smoothly shifts the zoom controls when the drawer opens on the right */
    zoom-controls {
        transition: right 0.3s ease;
    }

    /* Limits the width of the Shoelace settings drawer to approximately one-third of the screen. */
    sl-drawer {
        --size: 33%;
    }

    /* defines a border for the drawer sensitive to the side it is open */
    sl-drawer::part(panel) {
        border-left: 2px solid var(--sl-color-neutral-900);
        border-right: 2px solid var(--sl-color-neutral-900);
        border-top: 1px solid var(--sl-color-neutral-900);
        overflow: visible;
    }

    sl-drawer::part(body) {
        box-sizing: border-box;
        width: 100%;
        overflow-x: visible;
        overflow-y: auto;
    }

    sl-drawer.drawer-left::part(panel) {
        border-left: none;
    }

    sl-drawer.drawer-right::part(panel) {
        border-right: none;
    }

    /* similar style for delete button to be consistent to other diagrams */
    .delete-btn::part(base) {
        background-color: transparent;
        border-color: var(--sl-color-danger-600);
        color: var(--sl-color-danger-600);
    }

    .delete-btn::part(base):hover {
        background-color: var(--sl-color-danger-50);
        border-color: var(--sl-color-danger-700);
        color: var(--sl-color-danger-700);
    }

    /* Standardlayout für Drawer-Inhalte */
    .drawer-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        width: 100%;
        box-sizing: border-box;
        //overflow-x: hidden;
    }

    /* change styles of the drawer close button */
    sl-drawer::part(close-button) {
        font-size: var(--sl-font-size-x-large);
        display: flex;
        align-items: center;
    }

    /* Styles the main container for the lifeline header, using flexbox to center the icon and text with a fixed gap, while hiding any overflow. */
    .lifeline-box {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        background: var(--sl-color-neutral-0);
        border: 2px solid var(--sl-color-neutral-900);
        box-sizing: border-box;
        padding: 4px;
        gap: 8px; 
        overflow: hidden;
        touch-action: none;
        user-select: none;
        cursor: grab;
        transition: background-color 0.2s ease;
    }

    .lifeline:hover .lifeline-box {
        background: var(--sl-color-neutral-200);
    }

    /* Sets a fixed size for the lifeline icon and prevents it from shrinking when the container gets narrow. */
    .lifeline-icon {
        font-size: var(--sl-font-size-2x-large);
        flex-shrink: 0;
    }

    /* Stacks the text elements vertically and uses min-width: 0 to allow proper text truncation and wrapping within the flex container. */
    .lifeline-text-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 0; 
    }

    /* Styles the stereotype text in small italics, forcing it onto a single line and adding an ellipsis (...) if it overflows the available width. */
    .stereotype-label {
        font-size: var(--sl-font-size-x-small);
        font-style: italic;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
        text-align: center;
    }

    /* Styles the main lifeline name in bold, allowing the text to break and wrap onto new lines if it's too long to fit. */
    .name-label {
        font-weight: bold;
        font-size: var(--sl-font-size-small);
        text-align: center;
        word-break: break-word;
        text-decoration: underline;
    }

    /* Highlights invalid input and select fields by applying a red border and a subtle red background. */
    sl-input.has-error::part(base),
    sl-select.has-error::part(combobox) {
        border-color: var(--sl-color-danger-500);
        background-color: var(--sl-color-danger-50);
    }

    /* Colors the helper text below an invalid input red to ensure the error message catches the user's attention. */
    sl-input.has-error::part(help-text) {
        color: var(--sl-color-danger-600);
    }

    /* Ensures any icons placed inside an invalid input field also turn red to match the overall error state. */
    sl-input.has-error sl-icon {
        color: var(--sl-color-danger-500);
    }

    /* Fehlermeldung unter ungültigen Eingabefeldern */
    .validation-error {
        color: var(--sl-color-danger-600);
        font-size: var(--sl-font-size-small);
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Applies a 'grab' cursor to elements that can be moved, switching to a 'grabbing' cursor while the user is actively clicking and dragging them. */
    :host([interactionMode="idle"]) .lifeline-click-area,
    .message-hitbox,
    .draggable-activation,
    .fragment-header-hitbox {
        cursor: grab !important;
    }

    :host([interactionMode="idle"]) .lifeline-click-area:active,
    .message-hitbox:active,
    .draggable-activation:active,
    .fragment-header-hitbox:active {
        cursor: grabbing !important;
    }

    /* Applies a vertical resize cursor to the handles of lifelines, activations, and fragment regions, ensuring the cursor persists during the drag interaction. */
    .lifeline-handle,
    .activation-resize-handle,
    .fragment-operand-resize-handle {
        cursor: ns-resize !important;
    }

    .lifeline-handle:active,
    .activation-resize-handle:active,
    .fragment-operand-resize-handle:active {
        cursor: ns-resize !important;
    }

    /* Row: input stretches, button stays fixed-width, nothing overflows */
    .operand-row {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        margin-bottom: 10px;
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
    }

    /* Input wrapper takes remaining space but never grows beyond it */
    .operand-input-wrapper {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    /* Ensure sl-input never breaks out of its wrapper */
    .operand-input-wrapper sl-input {
        width: 100%;
    }
  
`;