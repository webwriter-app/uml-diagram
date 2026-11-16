import { css } from "lit";
import { HEAD_HEIGHT, HEAD_WIDTH } from "../../model/sequence-diagram/sequence-rules";

/** Styles for the Sequence Diagram Container. */
export default css`
    /* Fills the editor; the scene inside it carries the dotted grid, which follows panning and zooming */
    :host {
        display: block;
        width: 100%;
        height: 100%;
        background-color: var(--uml-canvas-background, var(--sl-color-neutral-0));
        overflow: hidden;
        position: relative;
    }

    ww-scene {
        position: absolute;
        inset: 0;
        background-color: var(--uml-canvas-background, var(--sl-color-neutral-0));
        --ww-scene-grid-color: var(--sl-color-neutral-300);
        --ww-scene-selection: var(--sl-color-primary-600);
        touch-action: none;
        /* Long presses open the element's menu instead of selecting text or showing Safari's callout */
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        cursor: default;
    }

    /* Change the cursor while 'moving' the whole diagram view */
    ww-scene:active {
        cursor: move;
    }

    /* The empty canvas cannot be panned */
    ww-scene.empty:active {
        cursor: default;
    }

    /* While dragging, keep the drag cursor instead of switching to the cursors of the elements passed over */
    ww-scene.dragging,
    ww-scene.dragging * {
        cursor: var(--drag-cursor) !important;
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

    /* Elements of the diagram are drawn by the scene; they take the same colors as the hovered and dragged elements of the class diagram */
    ww-path, ww-shape {
        stroke: var(--sl-color-neutral-900);
    }

    /* The dashed line of a lifeline */
    ww-path.lifeline-line {
        stroke-width: 2.5px;
        stroke-dasharray: 8 8;
        pointer-events: none;
    }

    ww-path.lifeline-line.active {
        stroke: var(--sl-color-primary-600);
    }

    /* The area of a lifeline that takes clicks and drags (and has the handle to make it longer) */
    ww-shape.lifeline-body {
        /* Nearly transparent: a fully transparent fill takes no pointer under Pixi */
        fill: rgb(0 0 0 / 0.4%);
        stroke: none;
        cursor: grab;
    }

    /* The line, arrowhead and text of a message; the hit width of the path makes it easy to press */
    ww-path.message-line {
        stroke-width: 1.5px;
        cursor: grab;
    }

    ww-path.message-line.dashed {
        stroke-dasharray: 5 5;
    }

    ww-path.message-line:state(hover),
    ww-path.message-line.active {
        stroke: var(--sl-color-primary-600);
    }

    ww-path.message-line ww-text {
        fill: var(--sl-color-neutral-900);
        stroke: none;
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
    }

    ww-shape.message-dot {
        fill: var(--sl-color-neutral-900);
        stroke: none;
        pointer-events: none;
    }

    ww-path.destroy-cross {
        stroke-width: 2.5px;
        pointer-events: none;
    }

    /* Hollow arrowheads are filled with the canvas color; the size follows the old heads */
    ww-path.message-line {
        --ww-scene-marker-fill: var(--sl-color-neutral-0);
        --ww-scene-marker-size: 13px;
    }

    /* An activation bar */
    ww-shape.activation-box {
        fill: var(--sl-color-neutral-0);
        stroke-width: 1.5px;
        cursor: grab;
    }

    ww-shape.activation-box:state(hover),
    ww-shape.activation-box.active {
        stroke: var(--sl-color-primary-600);
    }

    /* A fragment: the frame and the header take the pointer only at the header */
    ww-shape.fragment-background {
        fill: none;
        stroke: var(--sl-color-neutral-900);
        stroke-width: 1.5px;
        pointer-events: none;
    }

    ww-shape.fragment-background.overlapping {
        stroke: var(--sl-color-danger-500);
        stroke-width: 2.5px;
    }

    ww-shape.fragment-background.active,
    ww-shape.fragment-header.active,
    ww-shape.fragment-header:state(hover) {
        stroke: var(--sl-color-primary-600);
    }

    ww-shape.fragment-background.overlapping.active {
        stroke: var(--sl-color-danger-500);
    }

    ww-shape.fragment-header {
        fill: var(--sl-color-neutral-0);
        stroke: var(--sl-color-neutral-900);
        stroke-width: 1.5px;
        cursor: grab;
    }

    ww-path.fragment-header-fold {
        stroke-width: 1.5px;
        pointer-events: none;
    }

    ww-path.fragment-divider {
        stroke-width: 1.5px;
        stroke-dasharray: 8 8;
        pointer-events: none;
    }

    /* The regions only carry the handles that resize them */
    ww-shape.fragment-operand {
        fill: none;
        stroke: none;
        pointer-events: none;
    }

    ww-text.fragment-type,
    ww-text.fragment-guard {
        fill: var(--sl-color-neutral-900);
        stroke: none;
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        dominant-baseline: alphabetic;
        pointer-events: none;
    }

    ww-text.fragment-type {
        font-weight: bold;
    }

    /* While selecting lifelines (adding messages, activations or fragments), only the lifelines' line areas can be
       interacted with (the click position is used, e.g. for the message height) */
    :host(:not([interactionMode="idle"])) ww-shape.lifeline-body {
        cursor: pointer;
    }

    /* Smoothly shifts the zoom controls when the drawer opens on the right, with the
       same duration and easing as Shoelace's drawer slide animation */
    zoom-controls {
        transition: right 250ms ease;
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

    .icon-picker-label {
        font-size: var(--sl-input-label-font-size-medium);
        color: var(--sl-input-label-color);
        margin-bottom: var(--sl-spacing-3x-small);
    }

    /* span the full width like the inputs above */
    .icon-picker-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--sl-spacing-x-small);
    }

    .icon-picker-option::part(base) {
        width: 100%;
        height: auto;
        aspect-ratio: 1;
        align-items: center;
        justify-content: center;
    }

    .icon-picker-option::part(label) {
        display: flex;
        padding: 0;
        font-size: var(--sl-font-size-medium);
    }

    /* Styles the main container for the lifeline header, using flexbox to center the icon and text with a fixed gap, while hiding any overflow. */
    ww-node.lifeline-box {
        display: flex;
        align-items: center;
        justify-content: center;
        height: ${HEAD_HEIGHT}px;
        width: ${HEAD_WIDTH}px;
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

    ww-node.lifeline-box:hover,
    ww-node.lifeline-box.active {
        border-color: var(--sl-color-primary-600);
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
