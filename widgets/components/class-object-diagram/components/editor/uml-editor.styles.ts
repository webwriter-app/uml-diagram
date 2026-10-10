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
    /* Drawflow Canvas                                                            */
    /* -------------------------------------------------------------------------- */

    /* Main editor canvas with a dotted grid background that follows panning and zooming (grid variables are set by the editor) */
    #drawflowEditorDiv {
        position: relative;
        width: 100%;
        height: 100%;
        background-color: var(--uml-canvas-background, var(--sl-color-neutral-0));
        background-image: radial-gradient(circle, var(--sl-color-neutral-300) 1px, transparent 1px);
        background-size: var(--grid-size, 40px) var(--grid-size, 40px);
        background-position: var(--grid-x, 0) var(--grid-y, 0);
        overflow: hidden;
        /* Touches pan, zoom and drag the diagram instead of scrolling or zooming the page */
        touch-action: none;
        /* Long presses open the element's menu instead of selecting text or showing Safari's callout */
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
    }

    /* Hides the default Drawflow delete button */
    .drawflow-delete {
        display: none !important;
    }

    /* Drawflow core layout: fills the canvas and prevents accidental text selection on the side while dragging */
    .drawflow {
        width: 100%;
        height: 100%;
        position: relative;
        user-select: none;
        overflow: visible;
    }

    /* Positions the SVG layer behind nodes and allows connections to overflow */
    .drawflow svg {
        overflow: visible !important;
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: 1 !important;
    }

    /* -------------------------------------------------------------------------- */
    /* Drawflow Nodes                                                             */
    /* -------------------------------------------------------------------------- */

    /* Base layout for all Drawflow nodes */
    .drawflow .drawflow-node {
        display: flex;
        position: absolute;
        z-index: 2;
        background: var(--sl-color-neutral-0);
        border: 2px solid var(--sl-color-neutral-900);
        min-width: 30px;
        min-height: 30px;
        cursor: grab;
        transition: border-color var(--sl-transition-fast) ease;
    }

    /* Switches to grabbing cursor while actively dragging a node */
    .drawflow .drawflow-node:active {
        cursor: grabbing;
    }

    /* Outlines hovered nodes in the primary color (without moving them) */
    .drawflow .drawflow-node:hover {
        border-color: var(--sl-color-primary-600);
    }

    /* Switches to move cursor when panning the canvas background */
    #drawflowEditorDiv:active {
        cursor: move;
    }

    /* The empty canvas cannot be panned */
    #drawflowEditorDiv.empty:active {
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
    /* Node Ports (Input / Output)                                                */
    /* -------------------------------------------------------------------------- */

    /* Positions input ports (initially) centered on the node border */
    .drawflow .drawflow-node .input {
        transform: translate(-50%, -50%);
        position: absolute;
        width: 5px;
        height: 5px;
        background: transparent;
        border: 1px solid transparent;
        z-index: 10;
    }

    /* Positions output ports (initially) centered on the node border */
    .drawflow .drawflow-node .output {
        transform: translate(-50%, -50%);
        position: absolute;
        width: 5px;
        height: 5px;
        background: transparent;
        border: 1px solid transparent;
        z-index: 10;
    }

    /* -------------------------------------------------------------------------- */
    /* UML Class Node Design                                                      */
    /* -------------------------------------------------------------------------- */

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

    /* -------------------------------------------------------------------------- */
    /* Parameterized Class Template Box                                           */
    /* -------------------------------------------------------------------------- */

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
    /* Proxy Node (used for self-relations)                                       */
    /* -------------------------------------------------------------------------- */

    /* Makes the proxy node invisible and non-interactive */
    .uml-proxy-node {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        pointer-events: none;
    }

    /* Hides the content of the proxy node */
    .uml-proxy-node .drawflow_content_node {
        display: none;
    }

    /* -------------------------------------------------------------------------- */
    /* Connections and Arrows                                                     */
    /* -------------------------------------------------------------------------- */

    /* Makes the SVG container non-interactive so hover only fires on the paths */
    .drawflow .connection {
        pointer-events: none !important;
        z-index: 10;
    }

    /* Invisible wide hitbox path that makes connections easier to click */
    .drawflow .connection .back-path {
        display: block !important;
        fill: none !important;
        stroke: transparent !important;
        stroke-width: 30px !important;
        cursor: pointer !important;
        pointer-events: stroke !important;
        stroke-linecap: round;
    }

    /* Visible connection line */
    .drawflow .connection .main-path {
        fill: none !important;
        stroke: var(--sl-color-neutral-900);
        stroke-width: 2px;
        cursor: pointer;
        pointer-events: stroke !important;
        transition: stroke var(--sl-transition-fast) ease;
        paint-order: stroke;
    }

    /* Colors hovered connections (incl. their arrow heads) in the primary color */
    .drawflow .connection:hover .main-path {
        stroke: var(--sl-color-primary-600) !important;
    }

    /* In relation mode only classes can be selected, so connections can't be hovered or selected */
    .interaction-mode-active .drawflow .connection :is(.main-path, .back-path) {
        pointer-events: none !important;
    }

    /* Prevents the cursor from flickering over connection text labels */
    .drawflow .connection text {
        pointer-events: none;
        paint-order: stroke;
        stroke: var(--sl-color-neutral-50);
        stroke-width: 4px;
        stroke-linecap: round;
        stroke-linejoin: round;
        font-weight: bold;
    }

    /* -------------------------------------------------------------------------- */
    /* Arrow Markers per Relation Type                                            */
    /* -------------------------------------------------------------------------- */

    /* Closed triangle arrowhead for inheritance */
    .drawflow .connection.inheritance .main-path {
        marker-end: url(#arrow-triangle);
    }

    /* Dashed line with closed triangle for realization */
    .drawflow .connection.realization .main-path {
        stroke-dasharray: 10, 5;
        marker-end: url(#arrow-triangle);
    }

    /* Open arrowhead for directed association */
    .drawflow .connection.association .main-path {
        marker-end: url(#arrow-open);
    }

    /* Dashed line with open arrowhead for dependency */
    .drawflow .connection.dependency .main-path {
        stroke-dasharray: 10, 5;
        marker-end: url(#arrow-open);
    }

    /* Filled diamond arrowhead for composition */
    .drawflow .connection.composition .main-path {
        marker-end: url(#arrow-diamond-filled);
    }

    /* Empty diamond arrowhead for aggregation */
    .drawflow .connection.aggregation .main-path {
        marker-end: url(#arrow-diamond-hollow);
    }

    /* Open arrowheads at both ends for bidirectional association */
    .drawflow .connection.association-bidirectional .main-path {
        marker-end: url(#arrow-open);
        marker-start: url(#arrow-open);
    }

    /* No arrowheads for undirected association */
    .drawflow .connection.association-undirected .main-path {
        marker-end: none;
        marker-start: none;
    }

    /* -------------------------------------------------------------------------- */
    /* Relation Mode Interaction                                                  */
    /* -------------------------------------------------------------------------- */

    /* In relation mode, marks all nodes that can be clicked with a dashed outline (outside the border, so nothing moves) */
    .interaction-mode-active .drawflow-node:not(.uml-proxy-node) {
        cursor: crosshair;
        outline: 2px dashed var(--sl-color-primary-400);
        outline-offset: 3px;
    }

    /* Marks the node selected as the relation source with the (solid) Shoelace focus ring */
    .interaction-mode-active .drawflow-node.node-source-selected {
        border-color: var(--sl-color-primary-600);
        outline: var(--sl-focus-ring);
        outline-offset: var(--sl-focus-ring-offset);
    }
`;
