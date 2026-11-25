import { LitElementWw } from "@webwriter/lit";
import { widgetMsg } from "@webwriter/lit/localize";
import { SceneController } from "@webwriter/lit/scene";
import { Viewport } from "@webwriter/lit/viewport";
import { Scene, sceneElements, webglAvailable, type ActivateDetail, type ContextDetail, type MoveDetail, type MovingDetail, type SelectDetail } from "@webwriter/widget/scene";
import { PixiScene } from "@webwriter/widget/scene/pixi";
import { html, nothing } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import { query, state, property } from "lit/decorators.js";
import { ClassModel } from "../../model/class-object-diagram/class-model";
import { ClassDialog } from "./class-dialog";
import { ClassSettings } from "../../model/class-object-diagram/class-settings-model";
import { RelationDialog, RelationDialogData, relationLabel } from "./relation-dialog";
import { ClassDiagram, type Relation } from "../../model/class-object-diagram/diagram";
import { relationIssues, type RelationValidationIssue } from "../../model/class-object-diagram/relation-rules";
import { DASHED_TYPES, MARKERS, boxAnchor } from "../../model/class-object-diagram/relation-drawing";
import { renderClassBox } from "./class-box";
import canvasAlertStyles from "../shared/canvas-alert.styles";
import styles from "./uml-editor.styles";
import { default as SlButton } from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import { default as SlIcon } from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { default as SlAlert } from "@shoelace-style/shoelace/dist/components/alert/alert.component.js";
import alertCircleIcon from "@tabler/icons/outline/alert-circle.svg";
import infoCircleIcon from "@tabler/icons/outline/info-circle.svg";
import { ZoomControls } from "../zoom-controls/zoom-controls";
import { GlobalSettings } from "../../model/global-settings/global-settings-model";
import { cancelOnOutsideInteraction } from "../shared/cancel-on-outside-interaction";
import { ConfirmDialog, ConfirmOptions } from "../shared/confirm-dialog";
import { Point, Box, RelationEnds, routeMidpoint } from "../../model/class-object-diagram/route-geometry";
import { straightRoutes } from "../../model/class-object-diagram/straight-routes";
import { printWebglScenes } from "../shared/print-scene";

/** custom type for relation mode */
type InteractionType =
    'idle'  |
    'association'  |
    'association-bidirectional' |
    'association-undirected'    |
    'inheritance'  |
    'composition'  |
    'aggregation'  |
    'dependency'   |
    'realization'
;

const GRID_SIZE = 40;
const ZOOM_RANGE = { min: 0.5, max: 1.6 };
const ZOOM_STEP = 0.1;

/** Interactive editor for the Class and Object Diagram */
export class UMLEditor extends LitElementWw {
    msg = widgetMsg(this);

    /** Register used Elements; without WebGL the same template is drawn with SVG */
    static scopedElements = {
        ...sceneElements,
        "ww-scene": webglAvailable() ? PixiScene : Scene,
        "sl-button": SlButton,
        "sl-icon": SlIcon,
        "zoom-controls": ZoomControls,
        "uml-class-dialog": ClassDialog,
        "uml-relation-dialog": RelationDialog,
        "confirm-dialog": ConfirmDialog,
        "sl-alert": SlAlert
    };

    /** Styles are set in seperate file (./uml-editor.styles.ts) */
    static styles = [styles, canvasAlertStyles];

    /** The classes and relations. The widget stores what this holds. */
    readonly diagram = new ClassDiagram();

    /** Pan and zoom of the canvas; an empty canvas cannot be moved */
    #viewport = new Viewport(this, {
        can: () => this.diagram.classCount > 0,
        fit: { padding: 24, maxScale: 1, follow: "window", target: () => this.#scene.extent() }
    });
    #scene = new SceneController(this, { viewport: this.#viewport.core });

    @query("#canvas") accessor canvas!: HTMLElement;

    /** Defines accessor to the edit class/object dialog menu */
    @query("uml-class-dialog") accessor classEditDialog!: ClassDialog;

    /** Defines accessor to the edit relation/link dialog menu */
    @query("uml-relation-dialog") accessor relationEditDialog!: RelationDialog;

    /** Stores state of the interaction mode */
    @property() private accessor interactionMode:  InteractionType | 'idle' = 'idle';

    @state() private accessor _notice: string | null = null;

    /** Counts shown notices, so every notice gets its own alert (which restarts its auto-hide timer) */
    @state() private accessor _noticeCount = 0;

    @query("confirm-dialog") private accessor _confirmDialog!: ConfirmDialog;

    /** Stores Id of the relation source node while creating a new relation */
    @state() private accessor relationSourceNodeId: string | null = null;

    /** Tracks the current step of the relation creation process ('first' = select source, 'second' = select target) */
    @state() private accessor firstOrSecondClass: 'first' | 'second' | null = null;

    /** The key of the selected class, or of the selected relation */
    @state() private accessor selectedKey = '';

    /** Property to store the passed down diagram type */
    @property({ type: String }) accessor diagramType: string = 'class-diagram';

    /** Property to store the passed down class- or object settings */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Property to store the passed down state of the class or object diagram */
    @property({ attribute: false }) accessor savedDiagramData: string | null = null;

    /** Property for state of fullscreen */
    @property({ type: Boolean }) accessor isFullscreen: boolean = false;

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** The diagram data last loaded or sent to the widget, to tell outside changes (e.g. undo/redo) apart from our own edits */
    #lastEmittedData: string | null = null;

    /** The size of every class on the canvas, measured; relations are drawn between these boxes */
    #sizes = new Map<string, { width: number, height: number }>();

    /** Where the classes that are being dragged are shown now */
    #preview = new Map<string, Point>();

    #observer = new ResizeObserver(() => this.#measure());
    #observed = new Set<Element>();

    /** Aborting it removes the listeners that cancel the relation mode */
    #cancelListeners?: AbortController;

    /** Aborting it removes the listeners of the print view */
    #printing?: AbortController;

    /* 
    #################################################################################
    Lifecycle and Init
    #################################################################################
    */

    constructor() {
        super();
        // Fullscreen event listener to update the maximize/minimize button
        this.addEventListener('fullscreenchange', () => this.requestUpdate());
    }

    connectedCallback() {
        super.connectedCallback();
        this.#printing = new AbortController();
        printWebglScenes(this, this.#printing.signal, this.#viewport);
    }

    disconnectedCallback() {
        this.#printing?.abort();
        this._cancelAddRelation();
        this.#observer.disconnect();
        this.#observed.clear();
        super.disconnectedCallback();
    }

    /** Load the stored diagram, also when it was changed from outside, e.g. by undo/redo in WebWriter */
    protected willUpdate(changed: Map<string, unknown>) {
        if (changed.has('savedDiagramData') && this.savedDiagramData !== this.#lastEmittedData) {
            this.#load(this.savedDiagramData);
        }
    }

    protected firstUpdated() {
        // Report loaded counts without making WebWriter persist the unchanged diagram.
        this.#emitCounts();
    }

    protected updated() {
        // Relations are drawn between the measured boxes of the classes
        const nodes = new Set<Element>(this.renderRoot.querySelectorAll('ww-node'));
        for (const node of nodes) {
            if (!this.#observed.has(node)) this.#observer.observe(node);
        }
        for (const node of this.#observed) {
            if (!nodes.has(node)) this.#observer.unobserve(node);
        }
        this.#observed = nodes;

        // An empty canvas is reset to its initial view
        const view = this.#viewport;
        if (this.diagram.classCount === 0 && (view.x !== 0 || view.y !== 0 || view.scale !== 1)) view.fit();
    }

    /** Replaces the diagram with the given serialized data (or clears it if there is none) */
    #load(data: string | null) {
        this.#lastEmittedData = data;
        this.diagram.load(data);
        this.#preview = new Map();
        if (!this.diagram.node(this.selectedKey) && !this.diagram.relation(this.selectedKey)) this.selectedKey = '';
        this.requestUpdate();
        this.#emitCounts();
    }

    /** Load a checkpoint state into the editor */
    public loadCheckpoint(data: string) {
        if (!data) return;
        this.#load(data);
        this.#emit();
    }

    /** Sends the current diagram to the parent to update widget state */
    #emit() {
        const data = this.diagram.serialize();
        this.#lastEmittedData = data;
        this.dispatchEvent(new CustomEvent('diagram-data-changed', {
            detail: {
                diagramType: this.diagramType,
                data,
                classCount: this.diagram.classCount,
                relationCount: this.diagram.relationCount
            },
            bubbles: true,
            composed: true
        }));
    }

    /** Reports toolbar counts without persisting the loaded diagram. */
    #emitCounts() {
        this.dispatchEvent(new CustomEvent('diagram-counts-changed', {
            detail: { classCount: this.diagram.classCount, relationCount: this.diagram.relationCount },
            bubbles: true,
            composed: true
        }));
    }

    /** The diagram changed: draw it again and tell the widget */
    #changed() {
        this.requestUpdate();
        this.#emit();
    }

    #measure() {
        const sizes = new Map<string, { width: number, height: number }>();
        for (const node of this.renderRoot.querySelectorAll<HTMLElement>('ww-node')) {
            if (node.offsetWidth > 0) sizes.set(node.dataset.wwKey!, { width: node.offsetWidth, height: node.offsetHeight });
        }
        const same = sizes.size === this.#sizes.size
            && [...sizes].every(([key, size]) => this.#sizes.get(key)?.width === size.width && this.#sizes.get(key)?.height === size.height);
        if (same) return;
        this.#sizes = sizes;
        this.requestUpdate();
    }

    /* 
    #################################################################################
    What the reader does in the scene
    #################################################################################
    */

    #onSelect(event: CustomEvent<SelectDetail>) {
        if (event.defaultPrevented) return;
        this.selectedKey = event.detail.keys[0] ?? '';
    }

    #onMove(event: CustomEvent<MoveDetail>) {
        for (const { key, x, y } of event.detail.items) this.diagram.moveNode(key, x, y);
        this.#preview = new Map();
        this.#changed();
    }

    /** The relations are routed by the widget, so it needs to know where the classes are while they are dragged */
    #onMoving(event: CustomEvent<MovingDetail>) {
        const { state, items } = event.detail;
        const next = new Map<string, Point>(state === 'move' ? items.map(({ key, x, y }) => [key, { x, y }]) : []);
        const same = next.size === this.#preview.size
            && [...next].every(([key, at]) => this.#preview.get(key)?.x === at.x && this.#preview.get(key)?.y === at.y);
        if (same) return;
        this.#preview = next;
        this.requestUpdate();
    }

    /** A click picks a class in relation mode; a double click opens the dialog of a class or relation */
    #onActivate(event: CustomEvent<ActivateDetail>) {
        const { key, count, via } = event.detail;
        if (this.interactionMode !== 'idle') {
            if (this.diagram.node(key)) this._handleNodeSelection(key);
        } else if (count === 2 || via === 'keyboard') {
            this.#interact(key);
        }
    }

    /** The menu of a class or relation is its dialog (also by long press with a finger) */
    #onContext(event: CustomEvent<ContextDetail>) {
        event.preventDefault();
        if (event.detail.kind === 'node' || event.detail.kind === 'path') this.#interact(event.detail.key);
    }

    #onKeydown(event: KeyboardEvent) {
        const typing = (event.composedPath()[0] as HTMLElement).matches?.("input, textarea, [contenteditable]");
        if (typing || !(event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey))) return;
        if (this.diagram.relation(this.selectedKey)) this._deleteRelationById(this.selectedKey);
        else if (this.diagram.node(this.selectedKey)) this._deleteClassNode(this.selectedKey);
    }

    #zoom(step: number) {
        const scale = Math.min(Math.max(this.#viewport.scale + step, ZOOM_RANGE.min), ZOOM_RANGE.max);
        this.#viewport.zoomTo(Math.round(scale * 100) / 100);
    }

    /** Event handler for doubleclick or rightclick (interaction with elements) */
    #interact(key: string) {
        // only in idle mode
        if (this.interactionMode != 'idle') return;

        if (this.diagram.relation(key)) this.openRelationEditor(key);
        else this._openEditDialog(key);
    }

    /* 
    #################################################################################
    Class Management
    #################################################################################
    */

    /** The point of the diagram in the middle of the view */
    #viewCenter(): Point {
        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        return this.#viewport.toWorld(left + width / 2, top + height / 2);
    }

    /** Add a new empty class with a random factor around the center of the current view */
    public addClassNode(title: string, newType: string) {
        // check if max number of classes is reached
        if (this.diagram.classCount >= this.settings.maxClasses) {
            return;
        }

        // calculate where to add the new class (somewhere close to the middle, but with a little random +/-)
        const randomX = Math.floor(Math.random() * 61) - 30;
        const randomY = Math.floor(Math.random() * 61) - 30;
        const centre = this.#viewCenter();

        // initialize new class with custom name (and for objects also 'object' as objectName)
        const nodeData: ClassModel = {
            type: newType as ClassModel['type'],
            name: newType === 'object' ? title : this.diagram.uniqueClassName(title),
            attributes: [],
            methods: [],
            objectName: newType === 'object' ? 'object' : '',
            enumValues: [],
            associatedConnectionId: ''
        };

        this.diagram.addClass(nodeData, centre.x + randomX - 60, centre.y + randomY - 40);
        this.#changed();
    }

    /** Open the dialog to edit the given class and pass down all necessary information to the dialog */
    private _openEditDialog(id: string) {
        const node = this.diagram.node(id);
        if (!node) return;

        // For objects, don't check for duplicate names
        const namesForValidation = node.data.type === 'object' ? [] : this.diagram.otherClassNames(id);

        // show the dialog and pass down all necessary information
        this.classEditDialog?.show(id, node.data, namesForValidation, this.diagram.constraintsOf(id));
    }

    /** Safe the changes that were made in the dialog and pass the information up*/
    private _handleDialogSave(e: CustomEvent) {
        const { id, data } = e.detail;
        this.diagram.updateNodeData(id, data);
        this.#changed();
    }

    /** handle a class delete from within the dialog */
    private _handleDialogDelete(e: CustomEvent) {
        this._deleteClassNode(e.detail.id);
    }

    /** Delete a given class node together with its relations, association classes and proxy nodes */
    private _deleteClassNode(id: string) {
        this.diagram.removeNode(id);
        this.#dropSelection();
        this.#changed();
    }

    /** Forget a selection of something that is gone */
    #dropSelection() {
        if (!this.diagram.node(this.selectedKey) && !this.diagram.relation(this.selectedKey)) this.selectedKey = '';
    }

    /* 
    #################################################################################
    Relation Management (Logic)
    #################################################################################
    */

    /** Enter "relation mode" to start the creation process of a new relation of a given type */
    public _addRelation(relationType: string) {

        // check if max number of relation is reached
        if (this.diagram.relationCount >= this.settings.maxRelations) {
            return;
        }

        // initialize states for the "relation mode"
        this._cancelAddRelation();
        this.selectedKey = '';
        this._notice = null;
        this.interactionMode = relationType as InteractionType;
        this.relationSourceNodeId = null;
        this.firstOrSecondClass = 'first';

        // cancel on Escape, on presses or focus outside of the editor (e.g. on the toolbar) and when the window loses focus
        this.#cancelListeners = cancelOnOutsideInteraction(this, () => this._cancelAddRelation());
    }

    /** Handle the node selection process while in "relation mode" to create a new relation */
    private _handleNodeSelection(nodeId: string) {
        if (!this.relationSourceNodeId) {
            // Select source node
            this.relationSourceNodeId = nodeId;
            this.firstOrSecondClass = 'second';
        } else {
            // Select second node

            // check max relations constraint
            const currentRelations = this.diagram.relationsBetween(this.relationSourceNodeId, nodeId);
            if (currentRelations >= this.settings.maxNumberRelationsBetweenTwoClasses) {
                this.handleWrongSelection(this.msg("Maximum number of connections per pair reached"));
                return;
            }

            // check validation issues
            const issues = this._activeIssues(this.relationSourceNodeId, nodeId);
            if (issues.length > 0) {
                this.handleWrongSelection(issues.map(i => i.message).join('\n'));
                return;
            }

            const connectionType = this.interactionMode;
            const sourceId = this.relationSourceNodeId;
            this._cancelAddRelation();
            this.diagram.addRelation(sourceId, nodeId, connectionType);
            this.#changed();
        }
    }

    /** Helper method to display error for wrong node selection while creating a new relation */
    private handleWrongSelection(errorText: string) {
        this.showNotice(errorText);
        this._cancelAddRelation();
    }

    /** End the "relation mode" adding relations process due to canceling or just to reset environment after adding relation */
    private _cancelAddRelation() {
        // Resetting the mode and associated variables
        this.#cancelListeners?.abort();
        this.#cancelListeners = undefined;
        this.interactionMode = 'idle';
        this.relationSourceNodeId = null;
        this.firstOrSecondClass = null;
    }

    /** Delete a given relation (incl association classes) */
    private _deleteRelationById(relationId: string) {
        this.diagram.removeRelation(relationId);
        this.#dropSelection();
        this.#changed();
    }

    // #################################################################################
    // Relation Editor (Dialog Integration)
    // #################################################################################

    // Open dialog for editing a relation and pass down relevant data
    private openRelationEditor(relationId: string) {
        const relation = this.diagram.relation(relationId);
        const sourceNode = relation && this.diagram.node(relation.source);
        const targetNode = relation && this.diagram.node(relation.target);
        if (!relation || !sourceNode || !targetNode) return;

        let sourceName = sourceNode.data.name;
        let targetName = targetNode.data.name;

        if (sourceNode.data.isProxy) sourceName = "(Proxy)";
        if (targetNode.data.isProxy) {
             const parent = this.diagram.node(targetNode.data.parentNodeId!);
             targetName = parent ? `${parent.data.name} (Self)` : "Self";
        }

        // crate data package from the collected data to pass it to the dialog
        const dialogData: RelationDialogData = {
            id: relationId,
            type: this.diagram.typeOf(relation) ?? 'association',
            sourceClassName: sourceName,
            targetClassName: targetName,
            data: {
                name: relation.data.relationName || '',
                sourceMultiplicity: relation.data.sourceMultiplicity || '',
                targetMultiplicity: relation.data.targetMultiplicity || '',
                sourceRole: relation.data.sourceRole || '',
                targetRole: relation.data.targetRole || ''
            }
        };

        // open the dialog with the collected data
        this.relationEditDialog?.show(dialogData);
    }

    /** Update the relation data after changes in the relation dialog */
    private updateRelationData(relationId: string, data: Record<string, string>) {
        this.diagram.updateRelationData(relationId, {
            relationName: data.relationName,
            sourceMultiplicity: data.sourceMultiplicity,
            targetMultiplicity: data.targetMultiplicity,
            sourceRole: data.sourceRole,
            targetRole: data.targetRole
        });
    }

    /** Handler when changes in the relation dialog get saved */
    private _handleRelationSave(e: CustomEvent) {
        const { id, data } = e.detail;
        this.updateRelationData(id, data);
        this.#changed();
    }

    /** Save handler if at the same time a new association class is created */
    private _handleRelationSaveAndAddClass(e: CustomEvent) {
        const { id, data } = e.detail;
        this.updateRelationData(id, data);

        // create the new asscociation class for the given relation
        this._addAssociationClass(id);
        this.#changed();
    }

    /** Handler for the deletion of the relation from within the dialog */
    private _handleRelationDelete(e: CustomEvent) {
        this._deleteRelationById(e.detail.id);
    }

    /** create a new association class and draw a line to the middle of the relation */
    private _addAssociationClass(relationId: string) {
        // check for constraints
        if (this.diagram.classCount >= this.settings.maxClasses) {
            this.showNotice(this.msg("Maximum number of classes reached"));
            return;
        }

        // place the new class below a horizontal or right of a vertical middle of the association
        const route = this.#layout().routes.get(relationId);
        if (!route || route.length < 2) return;
        const { point, horizontal } = routeMidpoint(route);
        this.diagram.addAssociationClass(relationId, point, horizontal);
    }

    /** Clear the canvas */
    public clearCanvas() {
        this.diagram.clear();
        this.selectedKey = '';
        this.#changed();
    }

    /* 
    #################################################################################
    Rendering and UI-Helper
    #################################################################################
    */

    public async showNotice(message: string) {
        this._notice = message;
        this._noticeCount++;
        await this.updateComplete;
        (this.shadowRoot?.querySelector(".canvas-alert sl-alert") as SlAlert | null)?.show();
    }

    public confirm(options: ConfirmOptions): Promise<boolean> {
        return this._confirmDialog.confirm(options);
    }

    /** Where a class is shown: dragged, or where it is stored */
    #positionOf(id: string): Point {
        const node = this.diagram.node(id)!;
        return this.#preview.get(id) ?? { x: node.pos_x, y: node.pos_y };
    }

    /** The boxes of the classes and the route of every relation between them */
    #layout() {
        const boxes = new Map<string, Box>();
        for (const node of this.diagram.classes) {
            const id = String(node.id);
            const size = this.#sizes.get(id);
            if (size) boxes.set(id, { ...this.#positionOf(id), ...size });
        }
        const ends = new Map<string, RelationEnds>(this.diagram.relations().map(r => [r.id, { source: r.from, target: r.to }]));
        return { boxes, routes: straightRoutes(boxes, ends) };
    }

    // #################################################################################
    // Relation Validation
    // #################################################################################

    /** Filters relation validation issues based on the global validation mode */
    private _activeIssues(sourceId: string, targetId: string): RelationValidationIssue[] {
        const allIssues = relationIssues(this.diagram, this.interactionMode, sourceId, targetId, this.msg);

        if (this.globalSettings.validationMode === 'off') return [];
        if (this.globalSettings.validationMode === 'all') return allIssues;

        return allIssues.filter(issue => this.settings[issue.settingKey] === true);
    }

    // #################################################################################
    // render()
    // #################################################################################

    /** A multiplicity, role or name of a relation, placed on its line */
    #label(text: string | undefined, at: 'start' | 'middle' | 'end', along: number, side: 'above' | 'below' | 'right') {
        return text ? html`<ww-text at=${at} along=${along} side=${side} gap=${at === 'middle' ? 4 : 10}>${text}</ww-text>` : nothing;
    }

    /** The line of a relation, attached to its classes, with the heads and labels of its type */
    #renderRelation(relation: Relation, route: Point[], boxes: Map<string, Box>) {
        const type = this.diagram.typeOf(relation);
        const idle = this.interactionMode === 'idle';
        const { data } = relation;
        // The widget routes the line: the points of the route are the offsets from the centre of the class at its end, so the line follows the classes by itself
        const offset = (point: Point, box: Box) => `${+(point.x - box.x - box.width / 2).toFixed(2)},${+(point.y - box.y - box.height / 2).toFixed(2)}`;
        const [source, target] = [boxes.get(relation.from)!, boxes.get(relation.to)!];
        const waypoints = relation.self
            ? route.map(point => offset(point, source)).join(' ')
            : `${offset(route[0], source)} e:${offset(route[route.length - 1], target)}`;
        const markers = MARKERS[type ?? ''] ?? {};
        // The name of a loop stands outside of it
        const name = relation.self ? 'right' : 'above';

        return html`
            <ww-path
                data-ww-key=${relation.id}
                class=${classMap({ dashed: DASHED_TYPES.includes(type ?? '') })}
                from=${relation.from}
                to=${relation.to}
                waypoints=${waypoints}
                marker-start=${markers.start ?? 'none'}
                marker-end=${markers.end ?? 'none'}
                hit-width="30"
                ?selectable=${idle}
                ?selected=${this.selectedKey === relation.id}
            >
                ${this.#label(data.sourceMultiplicity, 'start', 26, 'above')}
                ${this.#label(data.sourceRole, 'start', 26, 'below')}
                ${this.#label(data.targetMultiplicity, 'end', -26, 'above')}
                ${this.#label(data.targetRole, 'end', -26, 'below')}
                ${this.#label(data.relationName, 'middle', 0, name)}
            </ww-path>`;
    }

    /** The dashed line from an association class to the middle of its relation */
    #renderAssociationLine(id: string, relationId: string, routes: Map<string, Point[]>, boxes: Map<string, Box>) {
        const route = routes.get(relationId);
        const box = boxes.get(id);
        if (!route || route.length < 2 || !box) return nothing;
        const { point } = routeMidpoint(route);
        return html`<ww-path class="association-class-line" .points=${[point, boxAnchor(box, point)]}></ww-path>`;
    }

    #renderNode(id: string) {
        const node = this.diagram.node(id)!;
        const idle = this.interactionMode === 'idle';
        return html`
            <ww-node
                data-ww-key=${id}
                outline="rect"
                class=${classMap({ 'node-source-selected': this.relationSourceNodeId === id })}
                x=${node.pos_x}
                y=${node.pos_y}
                ?selectable=${idle}
                ?movable=${idle}
                ?selected=${this.selectedKey === id}
            >${renderClassBox(node.data, this.settings)}</ww-node>`;
    }

    render() {
        const view = this.#viewport;
        const empty = this.diagram.classCount === 0;
        const { routes, boxes } = this.#layout();
        const classes = this.diagram.classes.map(node => String(node.id));

        return html`

            <div
                id="canvas"
                class="${this.interactionMode !== 'idle' ? 'interaction-mode-active' : ''} ${empty ? 'empty' : ''}"
                @keydown=${this.#onKeydown}
            >
                <ww-scene
                    select="single"
                    data-ww-viewport="canvas"
                    data-ww-viewport-fit="content"
                    data-ww-viewport-wheel="zoom"
                    data-ww-viewport-zoom="${ZOOM_RANGE.min} ${ZOOM_RANGE.max}"
                    background="dots"
                    background-spacing=${GRID_SIZE}
                    @ww-ready=${() => this.#viewport.fit()}
                    @ww-select=${this.#onSelect}
                    @ww-move=${this.#onMove}
                    @ww-moving=${this.#onMoving}
                    @ww-activate=${this.#onActivate}
                    @ww-context=${this.#onContext}
                >
                    ${repeat(this.diagram.relations().filter(r => (routes.get(r.id)?.length ?? 0) >= 2), r => r.id, r => this.#renderRelation(r, routes.get(r.id)!, boxes))}
                    ${this.diagram.classes.filter(node => node.data.associatedConnectionId).map(node =>
                        this.#renderAssociationLine(String(node.id), node.data.associatedConnectionId, routes, boxes))}
                    ${repeat(classes, id => id, id => this.#renderNode(id))}
                </ww-scene>
            </div>

            ${this._notice ? keyed(this._noticeCount, html`
                <div class="canvas-alert">
                    <sl-alert
                        variant="danger"
                        duration="5000"
                        closable
                        @sl-after-hide=${(e: Event) => { if (e.target === e.currentTarget) this._notice = null; }}
                    >
                        <sl-icon slot="icon" src=${alertCircleIcon}></sl-icon>
                        <span class="canvas-alert-text">${this._notice}</span>
                    </sl-alert>
                </div>
            `) : this.interactionMode !== 'idle' ? html`
                <div class="canvas-alert">
                    <sl-alert
                        variant="primary"
                        closable
                        open
                        @sl-hide=${(e: Event) => { if (e.target === e.currentTarget) this._cancelAddRelation(); }}
                    >
                        <sl-icon slot="icon" src=${infoCircleIcon}></sl-icon>
                        <span>
                            ${this.firstOrSecondClass === 'first'
                                ? this.msg(html`Select source for <strong>${relationLabel(this.interactionMode, this.diagramType === 'object-diagram', this.msg)}</strong>.`)
                                : this.msg(html`Select target for <strong>${relationLabel(this.interactionMode, this.diagramType === 'object-diagram', this.msg)}</strong>.`)}
                        </span>
                    </sl-alert>
                </div>
            ` : ''}

            ${empty ? html`
                <div class="empty-hint">
                    ${this.diagramType === 'object-diagram'
                        ? this.msg("Add objects via the toolbar above.")
                        : this.msg("Add classes via the toolbar above.")}
                </div>
            ` : ''}

            <zoom-controls
                .zoomLevel=${view.scale}
                .minZoom=${ZOOM_RANGE.min}
                .maxZoom=${ZOOM_RANGE.max}
                .isFullscreen=${this.isFullscreen}
                ?zoomDisabled=${empty}
                @zoom-in=${() => this.#zoom(ZOOM_STEP)}
                @zoom-out=${() => this.#zoom(-ZOOM_STEP)}
                @fit-to-view=${() => this.#viewport.fit()}
            ></zoom-controls>

            <uml-class-dialog 
                .settings=${this.settings}
                .globalSettings=${this.globalSettings}
                .diagramType=${this.diagramType}
                @save-class=${this._handleDialogSave} 
                @delete-class=${this._handleDialogDelete} 
                @dialog-opened=${() => {
                    this.dispatchEvent(new CustomEvent('dialog-opened', { bubbles: true, composed: true }));
                }}
                @dialog-closed=${() => this.dispatchEvent(new CustomEvent('dialog-closed', { bubbles: true, composed: true }))}
            ></uml-class-dialog>

            <uml-relation-dialog
                .settings=${this.settings}
                .globalSettings=${this.globalSettings}
                .diagramType=${this.diagramType}
                @save-relation=${this._handleRelationSave}
                @delete-relation=${this._handleRelationDelete}
                @save-and-add-class=${this._handleRelationSaveAndAddClass}
                @dialog-opened=${() => this.dispatchEvent(new CustomEvent('dialog-opened', { bubbles: true, composed: true }))}
                @dialog-closed=${() => this.dispatchEvent(new CustomEvent('dialog-closed', { bubbles: true, composed: true }))}
            ></uml-relation-dialog>

            <confirm-dialog></confirm-dialog>
        `;
    }
}
