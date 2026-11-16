import { css } from "lit";

/** Styles for the UML Editor component */
export default css`

    /* -------------------------------------------------------------------------- */
    /* Host Container                                                             */
    /* -------------------------------------------------------------------------- */

    /* Fills the available space of the parent container */
    :host {
        display: block;
        width: 100%;
        height: 100%;
    }

    /* -------------------------------------------------------------------------- */
    /* Canvas                                                                     */
    /* -------------------------------------------------------------------------- */

    /* Fills the editor; the scene inside it carries the dotted grid, which follows panning and zooming (set by the editor) */
    #canvas {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        /* Long presses open the element's menu instead of selecting text or showing Safari's callout */
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
    }

    ww-scene {
        position: absolute;
        inset: 0;
        background-color: var(--uml-canvas-background, var(--sl-color-neutral-0));
        /* Pointer drags pan the canvas */
        cursor: default;
        touch-action: none;
        --ww-scene-grid-color: var(--sl-color-neutral-300);
    }

    ww-scene:active {
        cursor: move;
    }

    #canvas.empty ww-scene:active {
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

    /* -------------------------------------------------------------------------- */
    /* Class Nodes                                                                */
    /* -------------------------------------------------------------------------- */

    ww-node {
        display: flex;
        background: var(--sl-color-neutral-0);
        border: 2px solid var(--sl-color-neutral-900);
        min-width: 30px;
        min-height: 30px;
        cursor: grab;
        transition: border-color var(--sl-transition-fast) ease;
        /* the outline of a selected node */
        --ww-scene-selection: var(--sl-color-primary-600);
    }

    /* Switches to grabbing cursor while actively dragging a node */
    ww-node:active {
        cursor: grabbing;
    }

    /* Outlines hovered nodes in the primary color (without moving them) */
    ww-node:hover,
    ww-node[selected] {
        border-color: var(--sl-color-primary-600);
    }

    ww-node:focus-visible {
        outline: var(--sl-focus-ring);
        outline-offset: var(--sl-focus-ring-offset);
    }

    /* Outer container for the UML class node content */
    .uml-class-container {
        display: flex;
        flex-direction: column;
        min-width: 150px;
        min-height: 80px;
        width: max-content;
        height: auto;
        box-sizing: border-box;
        position: relative;
    }

    /* Header section showing the class name and stereotype */
    .uml-class-header {
        padding: 8px;
        font-weight: bold;
        text-align: center;
        background-color: var(--sl-color-neutral-100);
        border-bottom: 1px solid var(--sl-color-neutral-700);
        color: var(--sl-color-neutral-900);
    }

    .uml-stereotype {
        font-size: var(--sl-font-size-small);
        font-weight: normal;
    }

    .underlined {
        text-decoration: underline;
    }

    .italic {
        font-style: italic;
    }

    /* Body section for attributes and methods */
    .uml-class-section {
        padding: 8px;
        font-size: var(--sl-font-size-small);
        min-height: 30px;
        background: var(--sl-color-neutral-0);
        color: var(--sl-color-neutral-700);
        text-align: left;
    }

    /* Adds a separator line between the attributes and methods sections */
    .uml-class-section.attributes {
        border-bottom: 1px solid var(--sl-color-neutral-700);
    }

    /* Dashed box in the top-right corner showing type parameters */
    .uml-template-box {
        position: absolute;
        bottom: calc(100% - 15px);
        right: -15px;
        max-width: 120px;
        min-width: 40px;
        min-height: 20px;
        background: var(--sl-color-neutral-0);
        border: 1px dashed var(--sl-color-neutral-700);
        padding: 4px 8px;
        font-size: var(--sl-font-size-small);
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        word-break: break-all;
    }

    /* -------------------------------------------------------------------------- */
    /* Relations                                                                  */
    /* -------------------------------------------------------------------------- */

    ww-path {
        stroke: var(--sl-color-neutral-900);
        stroke-width: 2px;
        cursor: pointer;
        /* Hollow heads (inheritance, aggregation) are filled with the canvas color */
        --ww-scene-marker-fill: var(--sl-color-neutral-0);
        --ww-scene-marker-size: 16px;
    }

    ww-path:state(hover) {
        stroke: var(--sl-color-primary-600);
    }

    ww-path.dashed {
        stroke-dasharray: 10 5;
    }

    /* The line from an association class to its relation */
    ww-path.association-class-line {
        stroke: var(--sl-color-neutral-700);
        stroke-dasharray: 5 5;
        cursor: default;
        pointer-events: none;
    }

    /* Multiplicities, roles and names of relations, with a halo of the canvas color */
    ww-path ww-text {
        fill: var(--sl-color-neutral-900);
        font-size: var(--sl-font-size-small);
        font-weight: bold;
        stroke: var(--sl-color-neutral-0);
        stroke-width: 4px;
    }

    /* -------------------------------------------------------------------------- */
    /* Relation Mode Interaction                                                  */
    /* -------------------------------------------------------------------------- */

    /* In relation mode, marks all nodes that can be clicked with a dashed outline (outside the border, so nothing moves) */
    .interaction-mode-active ww-node {
        cursor: crosshair;
        outline: 2px dashed var(--sl-color-primary-400);
        outline-offset: 3px;
    }

    /* Marks the node selected as the relation source with the (solid) Shoelace focus ring */
    .interaction-mode-active ww-node.node-source-selected {
        border-color: var(--sl-color-primary-600);
        outline: var(--sl-focus-ring);
        outline-offset: var(--sl-focus-ring-offset);
    }
`;
