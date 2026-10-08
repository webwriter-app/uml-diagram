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

    /* Invisible hit areas of the resize handles */
    :is(.lifeline-handle, .activation-resize-handle, .fragment-operand-resize-handle) {
        fill: transparent;
    }

    /* Grips of the resize handles, shown while hovering or dragging their element and filled while hovering or dragging the handle */
    .resize-grip {
        fill: var(--sl-color-neutral-0);
        stroke: var(--sl-color-primary-600);
        stroke-width: 1.5px;
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--sl-transition-fast) ease, fill var(--sl-transition-fast) ease;
    }

    :host([interactionMode="idle"]) svg:not(.dragging) :is(.lifeline, .activation, .fragment):hover .resize-grip,
    :host([interactionMode="idle"]) :is(.lifeline, .activation, .fragment).active .resize-grip {
        opacity: 1;
    }

    svg:not(.dragging) :is(.lifeline-handle, .activation-resize-handle, .fragment-operand-resize-handle):hover + .resize-grip,
    .dragged + .resize-grip {
        fill: var(--sl-color-primary-600);
    }

    /* Creates an invisible, interactive area over the lifeline */
    .lifeline-click-area {
        fill: transparent;
    }

    /* Colors a hovered or dragged lifeline (header box and dashed line) in the primary color, like hovered classes.
       While something is dragged (svg.dragging), only the dragged element is highlighted and hover states are off. */
    .lifeline-line {
        transition: stroke 0.2s ease;
    }

    svg:not(.dragging) .lifeline:hover .lifeline-line,
    .lifeline.active .lifeline-line {
        stroke: var(--sl-color-primary-600);
    }

    /* While selecting lifelines (adding messages, activations or fragments), only the lifelines' line areas can be
       interacted with (the click position is used, e.g. for the message height): clicks on other elements fall through */
    :host(:not([interactionMode="idle"])) :is(.message, .activation, .fragment, .fragment *, .lifeline-handle, .lifeline foreignObject) {
        pointer-events: none !important;
    }

    /* Applies a pointer cursor to lifelines while selecting them (e.g. as message source or target). */
    :host(:not([interactionMode="idle"])) .lifeline:hover .lifeline-click-area {
        cursor: pointer;
    }

    /* Styles the floating instruction banner centered at the bottom of the editor to guide the user during specific interactions. */
    .interaction-banner {
        position: absolute;
        bottom: var(--sl-spacing-medium);
        left: 50%;
        transform: translateX(-50%);
        z-index: 999;
        display: flex;
        align-items: center;
        gap: var(--sl-spacing-small);
        padding: var(--sl-spacing-3x-small) var(--sl-spacing-3x-small) var(--sl-spacing-3x-small) var(--sl-spacing-medium);
        background-color: var(--sl-color-neutral-0);
        color: var(--sl-color-neutral-700);
        border: var(--sl-input-border-width) solid var(--sl-input-border-color);
        border-radius: var(--sl-input-border-radius-medium);
        box-shadow: var(--sl-shadow-medium);
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        white-space: nowrap;
        pointer-events: auto;
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

    /* Colors a hovered message in the primary color (the arrow heads follow the line color via context-stroke) */
    .message-line {
        transition: stroke 0.2s ease;
    }

    svg:not(.dragging) .message:hover .message-line,
    .message.active .message-line {
        stroke: var(--sl-color-primary-600);
    }

    /* Colors the outline of a hovered activation box in the primary color */
    .activation-box {
        transition: stroke 0.2s ease;
    }

    svg:not(.dragging) .activation:hover .activation-box,
    .activation.active .activation-box {
        stroke: var(--sl-color-primary-600);
    }

    /* Colors the frame and header of a hovered fragment in the primary color (unless it is marked as overlapping) */
    .fragment-background,
    .fragment-header-hitbox,
    .fragment-header-fold {
        transition: stroke 0.2s ease;
    }

    svg:not(.dragging) .fragment:hover :is(.fragment-background:not(.overlapping), .fragment-header-hitbox, .fragment-header-fold),
    .fragment.active :is(.fragment-background:not(.overlapping), .fragment-header-hitbox, .fragment-header-fold) {
        stroke: var(--sl-color-primary-600);
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

    /* the drawer body scrolls vertically, but lets popups of its inputs overflow sideways */
    sl-drawer::part(body) {
        box-sizing: border-box;
        width: 100%;
        overflow-x: visible;
        overflow-y: auto;
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
        transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    svg:not(.dragging) .lifeline:hover .lifeline-box,
    .lifeline.active .lifeline-box {
        border-color: var(--sl-color-primary-600);
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

    /* Applies a 'grab' cursor to elements that can be moved, switching to a 'grabbing' cursor while the user is pressing them. */
    :host([interactionMode="idle"]) svg:not(.dragging) .lifeline-click-area,
    svg:not(.dragging) :is(.message, .draggable-activation, .fragment-header-hitbox) {
        cursor: grab !important;
    }

    :host([interactionMode="idle"]) svg:not(.dragging) .lifeline-click-area:active,
    svg:not(.dragging) :is(.message, .draggable-activation, .fragment-header-hitbox):active {
        cursor: grabbing !important;
    }

    /* Applies a vertical resize cursor to the handles of lifelines, activations, and fragment regions. */
    svg:not(.dragging) :is(.lifeline-handle, .activation-resize-handle, .fragment-operand-resize-handle) {
        cursor: ns-resize !important;
    }

    /* While dragging, keep the drag cursor everywhere instead of switching to the cursors of the elements passed over */
    svg.dragging,
    svg.dragging * {
        cursor: var(--drag-cursor) !important;
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