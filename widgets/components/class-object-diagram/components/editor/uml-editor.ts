import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { query, state, property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { ClassModel } from "../../models/class-model";
import { ClassDialog } from "../class-object-dialog/class-dialog";
import { ClassSettings } from "../../models/class-settings-model";
import { RelationDialog, RelationDialogData, relationLabel } from "../relation-link-dialog/relation-dialog";
import Drawflow from 'drawflow'
import { CanvasAlert } from "../../../shared/canvas-alert";
import styles from "./uml-editor.styles";
import { SlButton, SlIcon } from "@shoelace-style/shoelace";
import { ZoomControls } from "../../../zoom-controls/zoom-controls";
import { GlobalSettings } from "../../../global-settings/global-settings-model";
import { arrowMarkers } from "../../../shared/arrow-markers";
import { ConfirmDialog, ConfirmOptions } from "../../../shared/confirm-dialog";
import { Point, Box, RelationEnds, routeMidpoint, routeToPath } from "./route-geometry";
import { straightRoutes } from "./straight-routes";
import { Pinch, cancelOnOutsideInteraction, emulateTouchClicks, measurePinch } from "../../../shared/interaction";

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

/** Position of a relation label; y is the text baseline and anchor its SVG text-anchor */
interface LabelPosition {
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
}

/** Positions of the multiplicity and role label at one end of a relation */
interface EndLabelPositions {
    multiplicity: LabelPosition;
    role: LabelPosition;
}

/** Interface for relation validation issues */
interface RelationValidationIssue {
    message: string;
    settingKey: keyof ClassSettings;
}

/** Interactive editor for the Class and Object Diagram */
@localized()
export class UMLEditor extends LitElementWw{

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-button": SlButton,
            "sl-icon": SlIcon,
            "zoom-controls": ZoomControls,
            "uml-class-dialog": ClassDialog,
            "uml-relation-dialog": RelationDialog,
            "confirm-dialog": ConfirmDialog,
            "canvas-alert": CanvasAlert
        };
    }

    /** Styles are set in seperate file (./uml-editor.styles.ts) */
    static styles = [styles];

    /** Reference to the main Drawflow editor DOM element used to initialize and interact with the canvas */
    @query("#drawflowEditorDiv") accessor drawflowEditorDiv!: HTMLElement;

    /** Defines accessor to the edit class/object dialog menu */
    @query("uml-class-dialog") accessor classEditDialog!: any;

    /** Defines accessor to the edit relation/link dialog menu */
    @query("uml-relation-dialog") accessor relationEditDialog!: RelationDialog;

    /** Stores state of the interaction mode */
    @property() private interactionMode:  InteractionType | 'idle' = 'idle';

    @query("confirm-dialog") private accessor _confirmDialog!: ConfirmDialog;

    @query("canvas-alert") private accessor _alert!: CanvasAlert;

    /** Stores Id of the relation source node while creating a new relation */
    @state() private relationSourceNodeId: string | null = null;

    /** Tracks the current step of the relation creation process ('first' = select source, 'second' = select target) */
    @state() private firstOrSecondClass: 'first' | 'second' | null = null;

    /** Whether the diagram has no classes/objects; the canvas then shows a hint and cannot be panned or zoomed */
    @state() private accessor _isEmpty: boolean = true;

    /** Property to store the passed down diagram type */
    @property({ type: String }) accessor diagramType: string = 'class-diagram';

    /** Property to store the passed down class- or object settings */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Property to store the passed down state of the class or object diagram */
    @property({ attribute: false }) accessor savedDiagramData: any = null;

    /** Property for state of fullscreen */
    @property({ type: Boolean }) accessor isFullscreen: boolean = false;

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** 'any' because Drawflow's TypeScript definitions are apparently incomplete */
    private editor!: any;

    /** The fingers, zoom and canvas offset at the start of the current pinch; null while not pinching */
    private _pinchStart: { pinch: Pinch, zoom: number, x: number, y: number } | null = null;

    /** The diagram data last loaded or sent to the widget, to tell outside changes (e.g. undo/redo) apart from our own edits */
    private _lastEmittedData: string | null = null;

    /** Aborting it removes the listeners that cancel the relation mode */
    private _cancelListeners?: AbortController;

    /** variable to block the doubleclick while adding self-relations */
    private _blockDblClick: boolean = false;

    /** The last calculated route of every relation, by connection id */
    private _routes = new Map<string, Point[]>();

    /** Pending animation frame of _scheduleRouting */
    private _routingFrame = 0;

    /* 
    #################################################################################
    Lifecycle and Init
    #################################################################################
    */

    disconnectedCallback() {
        this._cancelAddRelation();
        super.disconnectedCallback();
    }

    /** Reload the diagram if the stored data was changed from outside, e.g. by undo/redo in WebWriter */
    protected updated(changed: Map<string, unknown>) {
        if (changed.has('savedDiagramData') && this.editor && this.savedDiagramData !== this._lastEmittedData) {
            this._loadDiagramData(this.savedDiagramData);
        }
    }

    /** Init the whole editor, set important variables, initial state and listeners */
    protected firstUpdated() {
        // Init editor
        this.editor = new Drawflow(this.drawflowEditorDiv);
        this.editor.reroute = false; 
        this.editor.zoom = 1;
        this.editor.curvature = 0;
        this.editor.start();

        // Drawflow's own pinch zoom only compares the horizontal finger distance and zooms in fixed steps around the
        // canvas center; _handlePinchTouch replaces it
        const div = this.drawflowEditorDiv;
        div.onpointerdown = div.onpointermove = div.onpointerup = null;
        div.onpointercancel = div.onpointerout = div.onpointerleave = null;

        emulateTouchClicks(div);

        // Reload stored diagram
        this._loadDiagramData(this.savedDiagramData);

        // Realtime updates of the diagram while node is moving
        this.drawflowEditorDiv.addEventListener('mousemove', (e) => {
            this._handleLiveMove();
        });
        this.drawflowEditorDiv.addEventListener('touchmove', (e) => {
            this._handleLiveMove();
        });

        // final update at drop-of of the class
        this.editor.on("nodeMoved", (nodeId: string) => {
            this.updateNodeVisuals(nodeId);
            this._serializeAndEmit();
        });

        // Re-render on zoom changes to update the zoom level display and move the background grid
        // (Drawflow updates canvas_x/canvas_y only after dispatching "zoom", so defer reading them)
        this.editor.on("zoom", () => {
            this.requestUpdate();
            queueMicrotask(() => this._updateGridBackground(this.editor.canvas_x, this.editor.canvas_y));
        });

        // While panning, Drawflow only reports the new offset through the "translate" event
        this.editor.on("translate", ({ x, y }: { x: number, y: number }) => this._updateGridBackground(x, y));

        // Resize also fires when a hidden editor becomes visible.
        new ResizeObserver(() => {
            this._updateGridBackground(this.editor.canvas_x, this.editor.canvas_y);
            this._scheduleRouting();
        }).observe(this.drawflowEditorDiv);

        // Keep selection clicks and canvas panning, but block element gestures in relation mode.
        const blockGestures = (e: Event) => {
            const target = e.target as Element;
            if (!this.drawflowEditorDiv.contains(target)) return;
            if (this._isEmpty || (this.interactionMode !== 'idle' && target.closest('.drawflow-node, .connection'))) {
                e.stopPropagation();
            }
        };
        this.renderRoot.addEventListener('mousedown', blockGestures, true);
        this.renderRoot.addEventListener('touchstart', blockGestures, true);

        // Drawflow only listens for mouseup on its container, so a drag released outside the widget would continue
        // once the cursor returns; end it before Drawflow handles the move
        this.renderRoot.addEventListener('mousemove', (e) => {
            const { editor } = this;
            if ((e as MouseEvent).buttons === 0 && (editor.drag || editor.drag_point || editor.editor_selected)) {
                editor.dragEnd(e);
            }
        }, true);

        // Pinch to zoom, also captured on the shadow root to keep the pinch's touches from Drawflow
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
            this.renderRoot.addEventListener(type, (e) => this._handlePinchTouch(e as TouchEvent), true);
        }

        // Listener for mouse weel to zoom in and out (disabled while the canvas is empty)
        this.drawflowEditorDiv.addEventListener('wheel', (e: WheelEvent) => {
            if (this._isEmpty) return;
            e.preventDefault();
            if (e.deltaY < 0) {
                this.editor.zoom_in();
            } else {
                this.editor.zoom_out();
            }
        }, { passive: false });

        // Fullscreen event listener to update the maximize/minimize button
        this.addEventListener('fullscreenchange', () => this.requestUpdate());

        // Inform the widget about a new node
        this.editor.on("nodeCreated", () => this._serializeAndEmit());

        // Inform the widget about a deleted node
        this.editor.on("nodeRemoved", () => this._serializeAndEmit());

        // Inform the widget about a new connection
        this.editor.on("connectionCreated", () => this._serializeAndEmit());

        // Inform the widget about a deleted connection
        this.editor.on("connectionRemoved", () => this._serializeAndEmit());

        // Classes and relations that are added or removed change the routes of the other relations
        for (const event of ["nodeCreated", "nodeRemoved", "connectionCreated", "connectionRemoved"]) {
            this.editor.on(event, () => this._scheduleRouting());
        }

        // on doubleclick handle any entity interaction
        this.drawflowEditorDiv.addEventListener('dblclick', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            this._handleEntityInteraction(target, e.clientX, e.clientY);
        });

        // on rightclick handle entity interaction (same as for doubleclick, but additionally prevent default)
        this.drawflowEditorDiv.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault(); 
            e.stopPropagation();

            const target = e.target as HTMLElement;
            this._handleEntityInteraction(target, e.clientX, e.clientY);
        });

        // Add listener for click to chose classes (only in "relation mode")
        this.drawflowEditorDiv.addEventListener('click', (e: MouseEvent) => {
            if (this.interactionMode === 'idle') return;

            const target = e.target as HTMLElement;
            const nodeElement = target.closest('.drawflow-node');
            if (nodeElement) {
                const nodeId = nodeElement.id.replace('node-', '');
                this._handleNodeSelection(nodeId);
            }
        });

        // init update for the container and toolbar about number of elements and so on
        setTimeout(() => this._serializeAndEmit(), 150);
    }

    /** Event handler for doubleclick or rightclick (interaction with elements) */
    private _handleEntityInteraction(target: HTMLElement, x: number, y: number) {
        // only in idle mode
        if (this.interactionMode != 'idle') return;
        if (this._blockDblClick) return;

        // element is a node
        const nodeElement = target.closest('.drawflow-node');
        if (nodeElement) {
            const nodeId = nodeElement.id.replace('node-', '');
            this._openEditDialog(nodeId);
            return;
        }

        // element is a relation
        if (target.classList.contains('main-path') || target.classList.contains('back-path')) {
            const svgElement = target.closest('svg');
            if (svgElement) {
                const ignoredClasses = [
                    'connection', 
                    'association', 
                    'association-bidirectional',
                    'association-undirected',
                    'inheritance', 
                    'composition', 
                    'aggregation', 
                    'dependency', 
                    'realization'
                ];

                const connectionId = Array.from(svgElement.classList)
                    .filter(c => !ignoredClasses.includes(c))
                    .join('_');
                
                this.openRelationEditor(connectionId, x, y);
            }
        }
    }

    /** Event handler while a node is moving */
    private _handleLiveMove() {
        if (this.editor.drag && this.editor.node_selected) {
            const selectedId = this.editor.node_selected.id.replace('node-', '');

            // Overwrite Drawflow's paths before the next paint.
            this.updateNodeVisuals(selectedId);
        }
    }

    /** Load a checkpoint state into the editor */
    public loadCheckpoint(data: string) {
        if (!this.editor || !data) return;
        this._loadDiagramData(data, () => this._serializeAndEmit());
    }

    /**
     * Replaces the diagram with the given serialized Drawflow data (or clears it if there is none).
     * Relation styles, labels and node visuals are restored after Drawflow has rendered, then onRestored is called.
     */
    private _loadDiagramData(data: string | null, onRestored?: () => void) {
        this._lastEmittedData = data;
        this.editor.clear();
        if (!data) {
            this._updateEmptyState();
            return;
        }
        this.editor.import(JSON.parse(data));
        this._updateEmptyState();
        
        const exportedData = JSON.parse(data);
        const nodes = exportedData?.drawflow?.Home?.data;
        if (nodes) {
            Object.keys(nodes).forEach(nodeId => {
                const nodeData = nodes[nodeId].data;
                const newHTML = this._createClassNodeHTML(nodeData);
                const nodeContent = this.shadowRoot?.querySelector(`#node-${nodeId} .drawflow_content_node`);
                if (nodeContent) {
                    nodeContent.innerHTML = newHTML;
                }
            });

            setTimeout(() => {
                Object.keys(nodes).forEach(sourceId => {
                    const sourceNode = nodes[sourceId];
                    if (sourceNode.outputs) {
                        Object.keys(sourceNode.outputs).forEach(outputKey => {
                            const connections = sourceNode.outputs[outputKey].connections;
                            connections.forEach((conn: any) => {
                                const targetId = conn.node.toString();
                                const inPort = conn.output;
                                const connectionType = conn.data?.connectionType;
                                if (connectionType) {
                                    const selector = `svg.connection.node_out_node-${sourceId}.node_in_node-${targetId}.${outputKey}.${inPort}`;
                                    const connectionSvg = this.shadowRoot?.querySelector(selector);
                                    if (connectionSvg) {
                                        connectionSvg.classList.add(connectionType);
                                    }
                                }
                            });
                        });
                    }
                });

                this._routeRelations();

                onRestored?.();
            }, 300);
        }
    }

    /** Serializes the current Drawflow state and send it to the parent to update widget state */
    private _serializeAndEmit() {
        this._updateEmptyState();
        const data = JSON.stringify(this.editor.export());
        this._lastEmittedData = data;
        this.dispatchEvent(new CustomEvent('diagram-data-changed', {
            detail: { 
                diagramType: this.diagramType, 
                data,
                classCount: this._getClassCount(),
                relationCount: this._getRelationCount() 
            },
            bubbles: true,
            composed: true
        }));
    }

    /** Track whether the diagram is empty; an empty canvas is reset to its initial view */
    private _updateEmptyState() {
        this._isEmpty = this._getClassCount() === 0;
        if (this._isEmpty && (this.editor.canvas_x !== 0 || this.editor.canvas_y !== 0 || this.editor.zoom !== 1)) {
            this.editor.canvas_x = 0;
            this.editor.canvas_y = 0;
            this.editor.zoom = 1;
            this.editor.zoom_refresh();
        }
    }

    /**
     * Zoom and pan with two fingers. Once a second finger touches the canvas, Drawflow no longer sees the touches until
     * all fingers are lifted, so it does not pan or drag a class at the same time.
     */
    private _handlePinchTouch(e: TouchEvent) {
        if (this._isEmpty || !this.drawflowEditorDiv.contains(e.target as Node)) return;
        const { touches } = e;
        if (!this._pinchStart && (e.type !== 'touchstart' || touches.length < 2)) return;
        e.stopPropagation();

        if (!this._pinchStart) {
            // Drawing a connection is left to Drawflow, ignoring the second finger
            if (this.editor.connection || this.editor.drag_point) return;
            this._endDrawflowGesture();
        }
        // A single finger is ignored until lifted
        if (touches.length < 2) {
            if (touches.length === 0) this._pinchStart = null;
            return;
        }
        if (e.type === 'touchmove') return this._applyPinch(measurePinch(touches[0], touches[1]));

        // The pinch starts, or fingers were added or lifted: continue from their current position
        const { zoom, canvas_x: x, canvas_y: y } = this.editor;
        this._pinchStart = { pinch: measurePinch(touches[0], touches[1]), zoom, x, y };
    }

    /** End Drawflow's panning or class drag of the first finger as if it was lifted, so that a pinch can take over */
    private _endDrawflowGesture() {
        const editor = this.editor;
        if (editor.editor_selected) {
            // While panning, Drawflow only stores the new canvas offset once the finger is lifted
            editor.canvas_x += editor.mouse_x - editor.pos_x;
            editor.canvas_y += editor.mouse_y - editor.pos_y;
            editor.editor_selected = false;
        }
        if (editor.drag) {
            editor.drag = false;
            if (editor.pos_x !== editor.pos_x_start || editor.pos_y !== editor.pos_y_start) {
                editor.dispatch("nodeMoved", editor.ele_selected.id.slice(5));
            }
        }
    }

    /** Zoom by the change of the finger distance, keeping the canvas point under the fingers' midpoint under them */
    private _applyPinch(pinch: Pinch) {
        const start = this._pinchStart!;
        const editor = this.editor;
        const zoom = Math.min(Math.max(start.zoom * pinch.distance / start.pinch.distance, editor.zoom_min), editor.zoom_max);
        const ratio = zoom / start.zoom;

        // Drawflow scales around the canvas center
        const rect = this.drawflowEditorDiv.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        editor.canvas_x = (pinch.x - centerX) - ratio * (start.pinch.x - centerX - start.x);
        editor.canvas_y = (pinch.y - centerY) - ratio * (start.pinch.y - centerY - start.y);

        // zoom_refresh scales the offset by the zoom change, which is already included here
        editor.zoom = editor.zoom_last_value = zoom;
        editor.zoom_refresh();
    }

    /** Move and scale the dotted background grid with the Drawflow canvas, keeping the dots themselves the same size */
    private _updateGridBackground(canvasX: number, canvasY: number) {
        const zoom = this.editor.zoom;
        const { clientWidth, clientHeight } = this.drawflowEditorDiv;
        // Drawflow scales around the canvas center, so shift the grid origin accordingly
        const originX = canvasX + (clientWidth / 2) * (1 - zoom);
        const originY = canvasY + (clientHeight / 2) * (1 - zoom);
        this.drawflowEditorDiv.style.setProperty('--grid-size', `${40 * zoom}px`);
        this.drawflowEditorDiv.style.setProperty('--grid-x', `${originX}px`);
        this.drawflowEditorDiv.style.setProperty('--grid-y', `${originY}px`);
    }

    /* 
    #################################################################################
    Class Management
    #################################################################################
    */

    /** Add a new empty class with a random factor around the center of the current view */
    public addClassNode(title: string, newType: string) {
        if (!this.editor) return;

        // check if max number of classes is reached
        if (this._getClassCount() >= this.settings.maxClasses) {
            return;
        }

        // calculate where to add the new class (somewhere close to the middle, but with a little random +/-)
        const rect = this.drawflowEditorDiv.getBoundingClientRect();
        const zoom = this.editor.zoom;
        const randomX = Math.floor(Math.random() * 61) - 30;
        const randomY = Math.floor(Math.random() * 61) - 30;
        const centerX = (rect.width / 2 - this.editor.canvas_x / zoom) + randomX;
        const centerY = (rect.height / 2 - this.editor.canvas_y / zoom) + randomY;

        // initialize new class with custom name (and for objects also 'object' as objectName)
        const nodeData: ClassModel = {
            type: newType as 'standard' | 'abstract' | 'interface' | 'enum' | 'object' | 'param-class',
            name: newType === 'object' ? title : this._getUniqueClassName(title),
            attributes: [],
            methods: [],
            objectName: newType === 'object' ? 'object' : '',
            enumValues: [],
            associatedConnectionId: ''
        };
        
        // create HTML for new class
        const nodeHTML = this._createClassNodeHTML(nodeData);

        // add new class to the drawflow editor
        this.editor.addNode(
            'class', 
            0, 0, 
            centerX - 60, centerY - 40, 
            'uml-class', 
            nodeData, 
            nodeHTML, 
            false
        );
    }

    /** Generates a unique class name by appending a number if the name already exists */
    private _getUniqueClassName(baseName: string): string {
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const existingNames = Object.values(allNodes)
            .filter((n: any) => !n.data.isProxy)
            .map((n: any) => n.data.name || '');

        if (!existingNames.includes(baseName)) return baseName;

        let counter = 1;
        while (existingNames.includes(`${baseName}${counter}`)) {
            counter++;
        }
        return `${baseName}${counter}`;
    }

    /** Open the dialog to edit the given class and pass down all necessary information to the dialog */
    private _openEditDialog(id: string) {
        const node = this.editor.getNodeFromId(id);
        if (!node) return;
        const originalData = node.data as ClassModel;

        // get all other classnames
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const existingNames: string[] = Object.values(allNodes)
            .filter((n: any) => {
                if (n.id.toString() === id.toString()) return false;
                if (n.data.isProxy) return false;

                return true;
            })
            .map((n: any) => n.data.name || "");

        // collect all constraints that shouldn't be broken
        const constraints = this._getConstraintsForNode(id);

        // For objects, don't check for duplicate names
        const namesForValidation = node.data.type === 'object' ? [] : existingNames;

        // show the dialog and pass down all necessary information
        if (this.classEditDialog) {
            this.classEditDialog.show(id, originalData, namesForValidation, constraints);
        }
    }

    /** Safe the changes that were made in the dialog and pass the information up*/
    private _handleDialogSave(e: CustomEvent) {
        const { id, data } = e.detail;
        this.editor.updateNodeDataFromId(id, data);
        const newNodeHTML = this._createClassNodeHTML(data);
        const nodeContent = this.shadowRoot?.querySelector(`#node-${id} .drawflow_content_node`);
        if (nodeContent) {
            nodeContent.innerHTML = newNodeHTML;
        }
        // the class size may have changed
        this.updateNodeVisuals(id);
        this._serializeAndEmit();
    }

    /** handle a class delete from within the dialog */
    private _handleDialogDelete(e: CustomEvent) {
        const { id } = e.detail;
        this._deleteClassNode(id);
    }

    /** Delete a given class node (Important! Delete the relations before to also delete association classes, proxys and so on) */
    private _deleteClassNode(id: string) {
        // Check if association class to prevent fail because of "circle deletion"
        const node = this.editor.getNodeFromId(id);
        if (node && node.data && node.data.associatedConnectionId) {
            const connId = node.data.associatedConnectionId;
            const parts = connId.split('_');
            const sourceNodeClass = parts[5];
            const targetNodeClass = parts[2];
            const selector = `svg.connection.${sourceNodeClass.replace('node-', 'node_out_node-')}.${targetNodeClass.replace('node-', 'node_in_node-')}`;
            const svgElement = this.shadowRoot?.querySelector(selector);
            
            if (svgElement) {
                const line = svgElement.querySelector(`.assoc-line-${id}`);
                if (line) {
                    line.remove();
                }
            }
        }

        // Delete the connections of the node
        const connectionIds = this.getNodeConnectionsById(id);
        connectionIds.forEach(element => {
            this._deleteRelationById(element);
        });

        // Delete the class itself
        setTimeout(() => {
            this.editor.nodeselected = null;
            this.editor.removeNodeId(`node-${id}`);
        }, 10);
    }

    /** Helper function to get all connections of a node */
    private getNodeConnectionsById(nodeId: string): string[] {
        const node = this.editor.getNodeFromId(nodeId);

        // prevent "circle-deletion" errors
        if (!node) {
            return [];
        }

        const connectionIds: string[] = [];

        // get all connections with this node as source
        Object.keys(node.outputs).forEach(outPort => {
            node.outputs[outPort].connections.forEach((conn: any) => {
                const id = `node_in_node-${conn.node}_node_out_node-${nodeId}_${outPort}_${conn.output}`;
                connectionIds.push(id);
            });
        });

        // get all connections with this node as target
        Object.keys(node.inputs).forEach(inPort => {
            node.inputs[inPort].connections.forEach((conn: any) => {
                const id = `node_in_node-${nodeId}_node_out_node-${conn.node}_${conn.input}_${inPort}`;
                connectionIds.push(id);
            });
        });

        return [...new Set(connectionIds)];
    }

    /* 
    #################################################################################
    Relation Management (Logic)
    #################################################################################
    */

    /** Enter "relation mode" to start the creation process of a new relation of a given type */
    public _addRelation(relationType: string) {

        // check if max number of relation is reached
        if (this._getRelationCount() >= this.settings.maxRelations) {
            return;
        }

        // initialize states for the "relation mode"
        this._cancelAddRelation();
        this._endDrawflowGesture();
        // Clicks no longer reach Drawflow in relation mode, so its selection would stay deletable with the Delete key
        this.editor.node_selected?.classList.remove('selected');
        this.editor.node_selected = null;
        this.editor.connection_selected?.classList.remove('selected');
        this.editor.connection_selected = null;
        this.interactionMode = relationType as InteractionType;
        this.relationSourceNodeId = null;
        this.firstOrSecondClass = 'first';

        // cancel on Escape, on presses or focus outside of the editor (e.g. on the toolbar) and when the window loses focus
        this._cancelListeners = cancelOnOutsideInteraction(this, () => this._cancelAddRelation());

        this.requestUpdate();
    }

    /** Saves the connection type into Drawflow's internal data model */
    private _saveConnectionType(sourceId: string, targetId: string, inPort: string, connectionType: string) {
        const module = 'Home';
        const nodeData = this.editor.drawflow.drawflow[module].data;
        const sourceNode = nodeData[sourceId];
        if (sourceNode && sourceNode.outputs) {
            Object.keys(sourceNode.outputs).forEach(outputKey => {
                const connections = sourceNode.outputs[outputKey].connections;
                const connection = connections.find((conn: any) =>
                    conn.node.toString() === targetId.toString() && conn.output === inPort
                );
                if (connection) {
                    connection.data = { ...connection.data, connectionType };
                }
            });
        }
    }

    /** Handle the node selection process while in "relation mode" to create a new relation */
    private _handleNodeSelection(nodeId: string) {
        if (!this.relationSourceNodeId) {
            // Select source node
            this.relationSourceNodeId = nodeId;
            this.firstOrSecondClass = 'second';
            this.requestUpdate();
            const el = this.shadowRoot?.querySelector(`#node-${nodeId}`);
            el?.classList.add('node-source-selected');
        } else {
            // Select second node
            
            // check max relations constraint
            const currentRelations = this._getRelationsCountBetween(this.relationSourceNodeId, nodeId);
            if (currentRelations >= this.settings.maxNumberRelationsBetweenTwoClasses) {
                this.handleWrongSelection(msg("Maximum number of connections per pair reached"));
                return;
            }

            // check validation issues
            const issues = this._activeIssues(this.relationSourceNodeId, nodeId);
            if (issues.length > 0) {
                this.handleWrongSelection(issues.map(i => i.message).join('\n'));
                return;
            }

            // start different logic to finalize self-relations
            if (this.relationSourceNodeId === nodeId) {
                this.finalizeReflexiveRelation(nodeId);
                return;
            }

            // create the relation for non self-relations
            this._finalizeRelation(this.relationSourceNodeId, nodeId);
        }
    }

    /** Helper method to display error for wrong node selection while creating a new relation */
    private handleWrongSelection(errorText: string) {
        this.showNotice(errorText);
        this._cancelAddRelation();
    }

    /** Add a new self-relation */
    private finalizeReflexiveRelation(nodeId: string) {
        // Block doubleclick event to not open the class dialog
        this._blockDblClick = true;
        setTimeout(() => { this._blockDblClick = false; }, 300);

        const originalNode = this.editor.getNodeFromId(nodeId);

        // create proxy node
        const proxyId = this.editor.addNode(
            'proxy', 
            0, 0, 
            originalNode.pos_x - 50, originalNode.pos_y, 
            'uml-proxy-node', 
            { isProxy: true, parentNodeId: nodeId }, 
            '<div class="proxy-anchor"></div>', 
            false
        );

        // create prots
        const outPort = this._addPort(nodeId, 'output');
        const inPort = this._addPort(proxyId.toString(), 'input');

        // Save the connection type before canceling the relation mode (which resets interactionMode to 'idle')
        const currentConnectionType = this.interactionMode;
        this._cancelAddRelation();

        this._createRelationConnection(nodeId, proxyId.toString(), outPort, inPort, currentConnectionType);
    }

    /** Add a relation between two different nodes. */
    private _finalizeRelation(sourceId: string, targetId: string) {
        const outPort = this._addPort(sourceId, 'output');
        const inPort = this._addPort(targetId, 'input');
        const connectionType = this.interactionMode;
        this._cancelAddRelation();
        this._createRelationConnection(sourceId, targetId, outPort, inPort, connectionType);
    }

    private _createRelationConnection(sourceId: string, targetId: string, outPort: string, inPort: string, connectionType: string) {
        requestAnimationFrame(() => {
            // Drawflow creates the SVG synchronously.
            this.editor.addConnection(sourceId, targetId, outPort, inPort);
            const connectionId = `node_in_node-${targetId}_node_out_node-${sourceId}_${outPort}_${inPort}`;
            this._getConnectionSvg(connectionId)?.classList.add(connectionType);
            this._saveConnectionType(sourceId, targetId, inPort, connectionType);
            this._routeRelations();
            this._serializeAndEmit();
        });
    }

    /** End the "relation mode" adding relations process due to canceling or just to reset environment after adding relation */
    private _cancelAddRelation() {
        // Resetting the mode and associated variables
        this._cancelListeners?.abort();
        this._cancelListeners = undefined;
        this.interactionMode = 'idle';
        this.relationSourceNodeId = null;
        this.firstOrSecondClass = null;
        const selectedNodes = this.shadowRoot?.querySelectorAll('.node-source-selected');
        selectedNodes?.forEach(n => n.classList.remove('node-source-selected'));
        this.requestUpdate();
    }

    /** Add a new input or output Port to a given class (or recycle old ones) */
    private _addPort(nodeId: string, type: 'input' | 'output') {
        const node = this.editor.getNodeFromId(nodeId);
        if (!node) return null;

        // recycling
        const ports = type === 'input' ? node.inputs : node.outputs;
        const emptyPortKey = Object.keys(ports).find(key => ports[key].connections.length === 0);
        if (emptyPortKey) {
            return emptyPortKey;
        }

        // create new if recycling was impossible
        try {
            if (type === 'input') {
                this.editor.addNodeInput(nodeId);
            } else {
                this.editor.addNodeOutput(nodeId);
            }
            const newNode = this.editor.getNodeFromId(nodeId);
            const newPorts = type === 'input' ? newNode.inputs : newNode.outputs;
            const keys = Object.keys(newPorts);
            return keys[keys.length - 1];
        } catch (e) {
            // Fallback
            const newNode = this.editor.getNodeFromId(nodeId);
            const newPorts = type === 'input' ? newNode.inputs : newNode.outputs;
            const keys = Object.keys(newPorts);
            return keys[keys.length - 1];
        }
    }

    /** Delete a given relation (incl association classes) */
    private _deleteRelationById(relationId: string) {
        if (relationId) {
            const parts = relationId.split('_');
            const targetId = parts[2].replace('node-', '');
            const sourceId = parts[5].replace('node-', '');
            const outPort = parts[6] + '_' + parts[7];
            const inPort = parts[8] + '_' + parts [9];
            const sourceNode = this.editor.getNodeFromId(sourceId);
            const targetNode = this.editor.getNodeFromId(targetId);


            // If there is an associationClass delete it first
            const allNodes = this.editor.drawflow.drawflow.Home.data;
            const associationClassId = Object.keys(allNodes).find(id => 
                allNodes[id].data && allNodes[id].data.associatedConnectionId === relationId
            );
            if (associationClassId && this.editor.getNodeFromId(associationClassId)) {
                this._deleteClassNode(associationClassId);
            }

            // Delete proxy node if its a self-relation
            if (targetNode && targetNode.data && targetNode.data.isProxy) {
                this.editor.removeNodeId(`node-${targetId}`);
            }
            
            // Delete Connection
            if (sourceNode && targetNode) {
                this.editor.removeSingleConnection(sourceId, targetId, outPort, inPort);
            }

            // Update the editor to make all changes visible
            this.requestUpdate();
        }
    }

    // #################################################################################
    // Relation Editor (Dialog Integration)
    // #################################################################################

    // Open dialog for editing a relation and pass down relevant data
    private openRelationEditor(connectionId: string, x: number, y: number) {
        // collect relevant data
        const parts = connectionId.split('_');
        const targetId = parts[2].replace('node-', '');
        const sourceId = parts[5].replace('node-', '');
        const outPort = parts[6] + '_' + parts[7];
        const inPort = parts[8] + '_' + parts[9];

        const sourceNode = this.editor.getNodeFromId(sourceId);
        const targetNode = this.editor.getNodeFromId(targetId);

        if (!sourceNode || !targetNode) return;

        const sourceNodeClass = parts[5];
        const targetNodeClass = parts[2];
        const selector = `svg.connection.${sourceNodeClass.replace('node-', 'node_out_node-')}.${targetNodeClass.replace('node-', 'node_in_node-')}`;
        const svgElement = this.shadowRoot?.querySelector(selector);
        
        const types: string[] = [
            'association', 
            'association-bidirectional', 
            'association-undirected', 
            'inheritance', 
            'composition', 
            'aggregation', 
            'dependency', 
            'realization'
        ];

        let type = 'association';
        if (svgElement) {
             const found = types.find(t => svgElement.classList.contains(t));
             if (found) type = found;
        }

        const connectionData = this.editor.drawflow.drawflow['Home'].data[sourceId]
                        ?.outputs[outPort]
                        ?.connections
                        ?.find((c: any) => c.node.toString() === targetId.toString() && c.output === inPort)?.data; 
        let sourceName = sourceNode.data.name;
        let targetName = targetNode.data.name;

        if (sourceNode.data.isProxy) sourceName = "(Proxy)";
        if (targetNode.data.isProxy) {
             const parent = this.editor.getNodeFromId(targetNode.data.parentNodeId);
             targetName = parent ? `${parent.data.name} (Self)` : "Self";
        }

        // crate data package from the collected data to pass it to the dialog
        const dialogData: RelationDialogData = {
            id: connectionId,
            type: type,
            sourceClassName: sourceName,
            targetClassName: targetName,
            data: {
                name: connectionData?.relationName || '',
                sourceMultiplicity: connectionData?.sourceMultiplicity || '',
                targetMultiplicity: connectionData?.targetMultiplicity || '',
                sourceRole: connectionData?.sourceRole || '', 
                targetRole: connectionData?.targetRole || ''  
            }
        };

        // open the dialog with the collected data
        if (this.relationEditDialog) {
            this.relationEditDialog.show(dialogData);
        }
    }

    /** Update the relation data after changes in the relation dialog */
    private updateRelationData(connectionId: string, relationData: { sourceMultiplicity: string, targetMultiplicity: string, relationName: string, sourceRole: string, targetRole: string }) {
        const parts = connectionId.split('_');
        const targetId = parts[2].replace('node-', ''); 
        const sourceId = parts[5].replace('node-', '');
        const inPort = parts[8] + '_' + parts[9];
        const module = 'Home';
        const nodeData = this.editor.drawflow.drawflow[module].data;

        // get the connection, append the data and update the labels
        const sourceNode = nodeData[sourceId];
        if (sourceNode && sourceNode.outputs) {
            Object.keys(sourceNode.outputs).forEach(outputKey => {
                const connections = sourceNode.outputs[outputKey].connections;
                
                const connection = connections.find((conn: any) => 
                    conn.node.toString() === targetId.toString() && conn.output === inPort
                );
                
                if (connection) {
                    // keep the other data, e.g. the connection type
                    connection.data = {
                        ...connection.data,
                        sourceMultiplicity: relationData.sourceMultiplicity,
                        targetMultiplicity: relationData.targetMultiplicity,
                        relationName: relationData.relationName,
                        sourceRole: relationData.sourceRole,
                        targetRole: relationData.targetRole
                    };
                    
                    this.renderRelationLabels(connectionId);
                }
            });
        }
    }

    /** Handler when changes in the relation dialog get saved */
    private _handleRelationSave(e: CustomEvent) {
        const { id, data } = e.detail;
        
        // Update the data in the diagram and update state of the widget
        this.updateRelationData(id, {
            relationName: data.relationName,
            sourceMultiplicity: data.sourceMultiplicity,
            targetMultiplicity: data.targetMultiplicity,
            sourceRole: data.sourceRole,
            targetRole: data.targetRole
        });
        this._serializeAndEmit();
    }

    /** Save handler if at the same time a new association class is created */
    private _handleRelationSaveAndAddClass(e: CustomEvent) {
        const { id, data } = e.detail;

        // Update the data in the diagram
        this.updateRelationData(id, {
            relationName: data.relationName,
            sourceMultiplicity: data.sourceMultiplicity,
            targetMultiplicity: data.targetMultiplicity,
            sourceRole: data.sourceRole,
            targetRole: data.targetRole
        });

        // create the new asscociation class for the given relation
        this._addAssociationClass(id);
        this._serializeAndEmit();
    }

    /** Handler for the deletion of the relation from within the dialog */
    private _handleRelationDelete(e: CustomEvent) {
        const { id } = e.detail;
        this._deleteRelationById(id);
        this._serializeAndEmit();
    }

    /* 
    #################################################################################
    Rendering and UI-Helper
    #################################################################################
    */

    public async showNotice(message: string) {
        await this._alert.show(message);
    }

    public confirm(options: ConfirmOptions): Promise<boolean> {
        return this._confirmDialog.confirm(options);
    }

    /** Create a new visible node on the drawflow canvas */
    private _createClassNodeHTML(data: ClassModel): string {
        const container = document.createElement("div");
        container.classList.add("uml-class-container");
        
        const header = document.createElement("div");
        header.classList.add("uml-class-header");

        // Template box for parameterized classes 
        if (data.type === 'param-class') {
            const templateBox = document.createElement("div");
            templateBox.classList.add("uml-template-box");
            
            // Each isParam attribute gets its own line
            const params = data.attributes ? data.attributes.filter(a => a.isParam) : [];
            params.forEach(p => {
                const paramLine = document.createElement("div");
                paramLine.textContent = p.name;
                templateBox.appendChild(paramLine);
            });
            container.appendChild(templateBox);
        }

        // Check if the class is of type "object" to display the underline and name : className format
        const nameSpan = document.createElement("div");
        if (data.type === 'object') {
            const instanceStr = data.objectName || '';
            const classStr = data.name ? ` : ${data.name}` : '';
            nameSpan.textContent = instanceStr + classStr;
            nameSpan.style.textDecoration = "underline";
        } else {
            nameSpan.textContent = data.name;
        }

        // Check if class is abstract, interface, enum, etc., and add the <<type>> stereotype
        if (['abstract', 'interface', 'enum', 'datatype', 'record', 'annotation'].includes(data.type)) {
            const stereotype = document.createElement("div");
            stereotype.style.fontSize = "var(--sl-font-size-small)";
            stereotype.style.fontWeight = "normal";
            stereotype.textContent = `<<${data.type}>>`;
            header.appendChild(stereotype);

            if (data.type === 'abstract') {
                nameSpan.style.fontStyle = "italic";
            }
        }
        
        // add the generated contents to the header and container of the node
        header.appendChild(nameSpan);
        container.appendChild(header);

        // Assign symbols to the visibility
        const getSymbol = (v: string) => v === 'public' ? '+' : v === 'private' ? '-' : v === 'package' ? '~' : '#';
        
        // toggle visibility in objects dependant on settings
        const showVis = data.type !== 'object' || this.settings.showVisibilityInObjects;
        const renderVis = (v: string) => showVis ? `${getSymbol(v)} ` : '';

        // Determine separator logic (use '=' for objects, ':' for classes)
        const separator = data.type === 'object' ? ' = ' : ': ';

        // Create body of the class/object
        if (data.type === "enum") {
            // add enum content for enums
            const enumValuesDiv = document.createElement("div");
            enumValuesDiv.classList.add("uml-class-section", "enumaration");
            enumValuesDiv.innerHTML = data.enumValues.map(a => {
                return `<div><span>${a}</span></div>`
            }).join("");
            container.appendChild(enumValuesDiv);
        } else {
            // for none enum classes:

            // Create attribute section
            const attrDiv = document.createElement("div");
            attrDiv.classList.add("uml-class-section", "attributes");
            attrDiv.innerHTML = data.attributes && data.attributes.length > 0 
                ? data.attributes.map(a => {
                    const style = a.isStatic ? 'style="text-decoration: underline;"' : '';
                    const final = a.isFinal ? ' {readOnly}' : '';
                    return `<div>${renderVis(a.visibility)}<span ${style}>${a.name}</span>${separator}${a.type}${final}</div>`
                }).join("")
                : "&nbsp;"; 
            container.appendChild(attrDiv);

            // Determine method display logic (hide in objects if setting is false and hide in annotation)
            const showMeths = (data.type !== 'object' || this.settings.showMethodsInObjects) && data.type !== 'annotation';

            // crate the method section
            if (showMeths) {
                const methodDiv = document.createElement("div");
                methodDiv.classList.add("uml-class-section", "methods");
                methodDiv.innerHTML = data.methods && data.methods.length > 0 
                    ? data.methods.map(m => {
                        const style = m.isStatic ? 'style="text-decoration: underline;"' : '';
                        const final = m.isFinal ? ' {final}' : ''; 
                        const paramsString = m.parameters && m.parameters.length > 0
                            ? m.parameters.map(p => `${p.name}: ${p.type}`).join(", ")
                            : "";
                        
                        return `<div>${renderVis(m.visibility)}<span ${style}>${m.name}</span>(${paramsString}): ${m.returnType}${final}</div>`;
                    }).join("")
                    : "&nbsp;"; 
                container.appendChild(methodDiv);
            }
        }

        // return the final HTML container of the class
        return container.outerHTML;
    }

    /** Drawflow represents a self-relation with a proxy target. */
    private _isSelfRelation(sourceId: string, targetId: string): boolean {
        const targetNode = this.editor.getNodeFromId(targetId);
        return !!targetNode?.data?.isProxy && targetNode.data.parentNodeId === sourceId;
    }

    /** Calculates the routes of all relations and redraws their paths, labels and association class lines */
    private _routeRelations() {
        if (!this.editor) return;
        cancelAnimationFrame(this._routingFrame);
        this._routingFrame = 0;

        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const boxes = new Map<string, Box>();
        const relations = new Map<string, RelationEnds>();
        Object.entries<any>(allNodes).forEach(([id, node]) => {
            if (node.data?.isProxy) return;
            const nodeHTML = this.shadowRoot?.querySelector(`#node-${id}`) as HTMLElement;
            if (!nodeHTML || nodeHTML.offsetWidth <= 0) return;
            boxes.set(id, { x: node.pos_x, y: node.pos_y, width: nodeHTML.offsetWidth, height: nodeHTML.offsetHeight });

            Object.entries<any>(node.outputs).forEach(([outPort, output]) => {
                output.connections.forEach((conn: any) => {
                    const targetId = conn.node.toString();
                    // self-relations loop back to their class, the proxy node is only their target in Drawflow
                    relations.set(`node_in_node-${targetId}_node_out_node-${id}_${outPort}_${conn.output}`, {
                        source: id,
                        target: this._isSelfRelation(id, targetId) ? id : targetId
                    });
                });
            });
        });

        this._routes = straightRoutes(boxes, relations);
        this._drawRoutes();
        this._routes.forEach((_, connectionId) => {
            this.renderRelationLabels(connectionId);
            this._updateRelatedAssociationClass(connectionId);
        });
    }

    /** Draw the last calculated routes, replacing Drawflow's straight lines (also for the hitboxes) */
    private _drawRoutes() {
        this._routes.forEach((route, connectionId) => {
            const connectionSvg = this._getConnectionSvg(connectionId);
            if (!connectionSvg || route.length < 2) return;

            this._ensureBackPath(connectionSvg);
            const pathData = routeToPath(route);
            connectionSvg.querySelector('.main-path')?.setAttribute('d', pathData);
            connectionSvg.querySelector('.back-path')?.setAttribute('d', pathData);
        });
    }

    /** Route the relations in the next frame, e.g. after Drawflow added or removed a class or relation */
    private _scheduleRouting() {
        cancelAnimationFrame(this._routingFrame);
        this._routingFrame = requestAnimationFrame(() => this._routeRelations());
    }

    /** Get the SVG element of a relation by its connection id */
    private _getConnectionSvg(connectionId: string): SVGElement | null {
        const parts = connectionId.split('_');
        const selector = `svg.connection.node_out_${parts[5]}.node_in_${parts[2]}.${parts[6]}_${parts[7]}.${parts[8]}_${parts[9]}`;
        return this.shadowRoot?.querySelector(selector) as SVGElement | null;
    }

    /** calculate the optimal port positions for association classes */
    private calculateOptimalPortPositionsForAssertionClasses(nodeId: string, connectionX: number, connectionY: number){
        const node = this.editor.getNodeFromId(nodeId);
        if (!node) return null;

        const htmlNode = this.shadowRoot?.querySelector(`#node-${nodeId}`) as HTMLElement;
        if (!htmlNode) return null;

        const widthNode = htmlNode.offsetWidth;
        const hightNode = htmlNode.offsetHeight;

        // calculate borders of the class
        const left = node.pos_x;
        const right = node.pos_x + widthNode;
        const top = node.pos_y;
        const bottom = node.pos_y + hightNode;

        // Init port
        let port = { x: 0, y: 0 };

        // Check on which side of the middlepoint the connection is located and place the port accordingly
        if (connectionX < left) {
            port.x = left;
            if(connectionY < top) {
                port.y = top;
            } else if (connectionY > bottom) {
                port.y = bottom;
            } else {
                port.y = connectionY;
            }
        } else if (connectionX > right) {
            port.x = right
            if(connectionY < top) {
                port.y = top;
            } else if (connectionY > bottom) {
                port.y = bottom;
            } else {
                port.y = connectionY;
            }
        } else if (connectionY < top) {
            port.x = connectionX;
            port.y = top;
        } else if (connectionY > bottom) {
            port.x = connectionX;
            port.y = bottom;
        } else {
            port.x = right;
            port.y = top;
        }

        return port;
    }

    /** calculate the position for the labels of a relation and update them */
    private renderRelationLabels(connectionId: string) {
        const partsForSelector = connectionId.split('_');
        const sourceNodeId = partsForSelector[5].replace('node-', '');
        const targetNodeId = partsForSelector[2].replace('node-', '');
        const outputPortId = partsForSelector[6] + '_' + partsForSelector[7];
        const inputPortId = partsForSelector[8] + '_' + partsForSelector[9];

        const route = this._routes.get(connectionId);
        if (!route || route.length < 2) return;

        let source: EndLabelPositions, target: EndLabelPositions, name: LabelPosition;
        if (this._isSelfRelation(sourceNodeId, targetNodeId)) {
            ({ source, target, name } = this._getLoopLabelPositions(route));
        } else {
            const positions = this._getStraightLabelPositions(route[0], route[route.length - 1], sourceNodeId, targetNodeId);
            if (!positions) return;
            ({ source, target, name } = positions);
        }

        // get the data for the connection
        const connectionData = this.editor.drawflow.drawflow['Home'].data[sourceNodeId]
            ?.outputs[outputPortId]
            ?.connections
            ?.find((c: any) => c.node.toString() === targetNodeId.toString() && c.output === inputPortId)?.data;

        if (!connectionData) return;

        // get the svg element of the connection
        const svgElement = this._getConnectionSvg(connectionId);
        if (!svgElement) return;
        
        // Add the labels
        this.updateText('label-source', connectionData.sourceMultiplicity || '', source.multiplicity, svgElement);
        this.updateText('label-target', connectionData.targetMultiplicity || '', target.multiplicity, svgElement);
        this.updateText('label-source-role', connectionData.sourceRole || '', source.role, svgElement);
        this.updateText('label-target-role', connectionData.targetRole || '', target.role, svgElement);
        this.updateText('label-name', connectionData.relationName || '', name, svgElement);
    }

    /** Place labels beside the line, with roles and multiplicities near each end. */
    private _getStraightLabelPositions(start: Point, end: Point, sourceNodeId: string, targetNodeId: string) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length === 0) return null;

        const offset = { x: dx === 0 ? 30 : 30 * dy * Math.sign(dx) / length, y: -30 * Math.abs(dx) / length };

        // labels grow away from the line, or towards each other if they are right above a mostly horizontal relation
        const nodes = this.editor.drawflow.drawflow.Home.data;
        const mostlyHorizontal = Math.abs(nodes[targetNodeId].pos_x - nodes[sourceNodeId].pos_x) >= Math.abs(nodes[targetNodeId].pos_y - nodes[sourceNodeId].pos_y);
        const [sourceAnchor, targetAnchor]: LabelPosition['anchor'][] = mostlyHorizontal && Math.abs(offset.x) <= 1
            ? (start.x < end.x ? ['start', 'end'] : ['end', 'start'])
            : (offset.x < 0 ? ['end', 'end'] : ['start', 'start']);

        const distance = Math.max(Math.min(length * 0.1, 30), 20);
        const along = { x: dx / length * distance, y: dy / length * distance };
        // the labels at the upper end move up a line further
        const endLabels = (x: number, y: number, anchor: LabelPosition['anchor']): EndLabelPositions => ({
            multiplicity: { x, y: y + 5, anchor },
            role: { x, y: y + 20, anchor }
        });
        return {
            source: endLabels(start.x + along.x + offset.x, start.y + along.y + offset.y - (start.y > end.y ? 15 : 0), sourceAnchor),
            target: endLabels(end.x - along.x + offset.x, end.y - along.y + offset.y - (end.y > start.y ? 15 : 0), targetAnchor),
            name: { x: (start.x + end.x) / 2 + offset.x, y: (start.y + end.y) / 2 + offset.y + 5, anchor: 'middle' as const }
        };
    }

    /** Place self-relation labels to the left of the loop. */
    private _getLoopLabelPositions(route: Point[]): { source: EndLabelPositions, target: EndLabelPositions, name: LabelPosition } {
        const [start, outerTop, , end] = route;
        return {
            source: {
                multiplicity: { x: start.x - 15, y: start.y - 5, anchor: 'end' },
                role: { x: start.x - 15, y: start.y + 10, anchor: 'end' }
            },
            target: {
                multiplicity: { x: end.x - 15, y: end.y + 25, anchor: 'end' },
                role: { x: end.x - 15, y: end.y + 40, anchor: 'end' }
            },
            name: { x: outerTop.x - 30, y: (start.y + end.y) / 2 + 5, anchor: 'middle' }
        };
    }

    /** Sync the moved node's position and reroute the diagram. */
    private updateNodeVisuals(nodeId: string) {
        const movedNode = this.editor.getNodeFromId(nodeId);
        if (!movedNode) return;

        // Drawflow's stored position is one mouse delta ahead of the element.
        const movedNodeHTML = this.shadowRoot?.querySelector(`#node-${nodeId}`) as HTMLElement;
        const left = parseFloat(movedNodeHTML?.style.left);
        const top = parseFloat(movedNodeHTML?.style.top);
        if (!isNaN(left) && !isNaN(top)) {
            const storedNode = this.editor.drawflow.drawflow.Home.data[nodeId];
            storedNode.pos_x = left;
            storedNode.pos_y = top;
        }

        this._routeRelations();
    }

    /** Helper method to create or update text elements */
    private updateText(className: string, content: string, position: LabelPosition, svgElement: SVGElement) {
        
        // Check if element already exists
        let textEl = svgElement.querySelector(`.${className}`) as SVGTextElement;

        // if not create one
        if (!textEl) {
            textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textEl.classList.add(className);
            
            textEl.style.fill = 'var(--sl-color-neutral-900)';
            textEl.style.fontSize = 'var(--sl-font-size-small, 12px)';
            textEl.style.pointerEvents = 'none';
            
            svgElement.appendChild(textEl);
        }

        // update content
        textEl.textContent = content || '';
        textEl.setAttribute('x', position.x.toString());
        textEl.setAttribute('y', position.y.toString());
        
        // text-anchor controls the alignment point of the SVG text relative to its x coordinate
        // 'start' = grows right, 'middle' = centered, 'end' = grows left
        textEl.setAttribute('text-anchor', position.anchor);
    }

    /** Handle the clear/reset of the canvas */
    public clearCanvas() {
        if (this.editor) {
            this.editor.clear();
            this.editor.zoom = 1;
            this.editor.zoom_refresh();
            this._serializeAndEmit();
        }
    }

    // #################################################################################
    // Helper Methods for Limits / Counting
    // #################################################################################
    
    /** Hleper method to get all relation based constraints for changes/validation inside the dialog */
    private _getConstraintsForNode(nodeId: string): any[] {
        const constraints: any[] = [];
        const node = this.editor.getNodeFromId(nodeId);
        if (!node) return [];

        // for outgoing relations
        Object.keys(node.outputs).forEach(key => {
            node.outputs[key].connections.forEach((conn: any) => {
                const targetId = conn.node;
                const targetNode = this.editor.getNodeFromId(targetId);
                const selector = `svg.connection.node_out_node-${nodeId}.node_in_node-${targetId}`;
                const svg = this.shadowRoot?.querySelector(selector);
                
                let type = 'association';
                if (svg) {
                    if (svg.classList.contains('inheritance')) type = 'inheritance';
                    else if (svg.classList.contains('realization')) type = 'realization';
                    else if (svg.classList.contains('composition')) type = 'composition';
                    else if (svg.classList.contains('aggregation')) type = 'aggregation';
                }

                if (targetNode) {
                    constraints.push({ 
                        type: type, 
                        direction: 'source', 
                        otherNodeType: targetNode.data.type 
                    });
                }
            });
        });

        // for incoming relations
        Object.keys(node.inputs).forEach(key => {
            node.inputs[key].connections.forEach((conn: any) => {
                const sourceId = conn.node;
                const sourceNode = this.editor.getNodeFromId(sourceId);
                const selector = `svg.connection.node_out_node-${sourceId}.node_in_node-${nodeId}`;
                const svg = this.shadowRoot?.querySelector(selector);
                
                let type = 'association';
                if (svg) {
                    if (svg.classList.contains('inheritance')) type = 'inheritance';
                    else if (svg.classList.contains('realization')) type = 'realization';
                    else if (svg.classList.contains('composition')) type = 'composition';
                    else if (svg.classList.contains('aggregation')) type = 'aggregation';
                }

                if (sourceNode) {
                    constraints.push({ 
                        type: type, 
                        direction: 'target', 
                        otherNodeType: sourceNode.data.type 
                    });
                }
            });
        });

        return constraints;
    }

    /** Helper function to get the current number of classes (ignoring proxy nodes) */
    private _getClassCount(): number {
        if (!this.editor) return 0;
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const count = Object.values(allNodes).filter((n: any) => !n.data.isProxy).length;
        return count;
    }

    /** Helper function to get the current number of relations (ignoring the line to a associationclass) */
    private _getRelationCount(): number {
        if (!this.editor) return 0;
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        let count = 0;
        Object.values(allNodes).forEach((n: any) => {
            Object.values(n.outputs).forEach((out: any) => {
                count += out.connections.length;
            });
        });
        return count;
    }

    /** Helper funciton to get the current number ob relations between two classes */
    private _getRelationsCountBetween(id1: string, id2: string): number {
        if (!this.editor) return 0;
        const node1 = this.editor.getNodeFromId(id1);
        const node2 = this.editor.getNodeFromId(id2);
        if (!node1 || !node2) return 0;
        let count = 0;

        // for one direction
        Object.values(node1.outputs).forEach((out: any) => {
            out.connections.forEach((conn: any) => {
                if (conn.node.toString() === id2.toString()) {
                    count++;
                }
            });
        });

        // for the other direction
        if (id1 !== id2) {
            Object.values(node2.outputs).forEach((out: any) => {
                out.connections.forEach((conn: any) => {
                    if (conn.node.toString() === id1.toString()) {
                        count++;
                    }
                });
            });
        }

        return count;
    }

    /** Ensure that the relation has a synchronized backpath (hitbox) */
    private _ensureBackPath(svg: SVGElement) {
        if (!svg) return;

        // does the backpath exist (if not create one)
        let backPath = svg.querySelector('.back-path');
        if (!backPath) {
            const mainPath = svg.querySelector('.main-path');
            if (mainPath) {
                backPath = mainPath.cloneNode(true) as SVGElement;
        
                /** correct the class after creation */
                backPath.classList.remove('main-path');
                backPath.classList.add('back-path');

                svg.appendChild(backPath);
            }
        }
    }

    /** Own logic of updating association classes */
    private _updateRelatedAssociationClass(connectionId: string) {
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const assocClassId = Object.keys(allNodes).find(id => 
            allNodes[id].data && allNodes[id].data.associatedConnectionId === connectionId
        );

        if (assocClassId) {
            this._updateAssociationClassLine(assocClassId);
        }
    }

    /** Update the line between an association class and the association */
    private _updateAssociationClassLine(nodeId: string) {
        if (!this.editor) return;

        const node = this.editor.getNodeFromId(nodeId);
        const connectionId = node.data.associatedConnectionId;
        if (!connectionId) return;

        const parts = connectionId.split('_');
        const sourceNodeClass = parts[5];
        const targetNodeClass = parts[2];
        const selector = `svg.connection.${sourceNodeClass.replace('node-', 'node_out_node-')}.${targetNodeClass.replace('node-', 'node_in_node-')}`;
        const svgElement = this.shadowRoot?.querySelector(selector) as SVGElement;

        if (!svgElement) return;

        const middle = this.getMiddleOfConnection(connectionId);
        if (!middle) return;
        const mid = middle.point;
        const classAnchor = this.calculateOptimalPortPositionsForAssertionClasses(nodeId, mid.x, mid.y);

        let line = svgElement.querySelector(`.assoc-line-${nodeId}`) as SVGLineElement;

        if (!line) {
            line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.classList.add(`assoc-line-${nodeId}`);
            line.setAttribute('stroke', 'var(--sl-color-neutral-700)');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '5,5');
            svgElement.appendChild(line);
        }

        line.setAttribute('x1', mid.x.toString());
        line.setAttribute('y1', mid.y.toString());
        line.setAttribute('x2', classAnchor.x.toString());
        line.setAttribute('y2', classAnchor.y.toString());
    }

    /** Helper method to get the middle point of a relation and whether the line there is horizontal */
    private getMiddleOfConnection(connectionId: string): { point: Point, horizontal: boolean } | null {
        const route = this._routes.get(connectionId);
        return route && route.length >= 2 ? routeMidpoint(route) : null;
    }

    /** create a new Assertion class and draw a line to the middle of the connection */
    private _addAssociationClass(connectionId: string) {
        if (!this.editor) return;

        // check for constraints
        if (this._getClassCount() >= this.settings.maxClasses) {
            this.showNotice(msg("Maximum number of classes reached"));
            return;
        }

        // place the new class below a horizontal or right of a vertical middle of the association
        const middle = this.getMiddleOfConnection(connectionId);
        if (!middle) return;

        let centerX = middle.point.x;
        let centerY = middle.point.y;
        if (middle.horizontal) {
            centerY += 100;
        } else {
            centerX += 100;
        }

        // initialize new class
        const nodeData: ClassModel = {
            type: 'standard',
            name: "NewAssociationClass",
            attributes: [],
            methods: [],
            objectName: '',
            enumValues: [],
            associatedConnectionId: connectionId
        };
        
        // create HTML for the class
        const nodeHTML = this._createClassNodeHTML(nodeData);

        // add new class to the drawflow editor
        const newNodeId = this.editor.addNode(
            'class', 
            0, 0, 
            centerX - 60, centerY - 40, 
            'uml-class', 
            nodeData, 
            nodeHTML, 
            false
        );

        this._updateAssociationClassLine(newNodeId);
    }

    /* 
    #################################################################################
    Relation Validation
    #################################################################################
    */

    /** Helper Method to detect cycle of inheritance/realisation */
    private _detectCycle(sourceId: string, targetId: string): boolean {
        const queue: string[] = [targetId];
        const visited = new Set<string>();
        visited.add(targetId);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (currentId === sourceId) {
                return true;
            }
            const currentNode = this.editor.getNodeFromId(currentId);
            if (!currentNode) continue;

            // check all outgoing relations (but filter for inheritance/realisation)
            Object.keys(currentNode.outputs).forEach(portKey => {
                currentNode.outputs[portKey].connections.forEach((conn: any) => {
                    const nextNodeId = conn.node;
                    const selector = `svg.connection.node_out_node-${currentId}.node_in_node-${nextNodeId}`;
                    const svg = this.shadowRoot?.querySelector(selector);
                    
                    if (svg) {
                        const isInheritance = svg.classList.contains('inheritance');
                        const isRealization = svg.classList.contains('realization');

                        if ((isInheritance || isRealization) && !visited.has(nextNodeId)) {
                            visited.add(nextNodeId);
                            queue.push(nextNodeId);
                        }
                    }
                });
            });
        }

        return false;
    }

    /** Helper to check if an existing relation of a given type already exists between two nodes */
    private _hasExistingRelation(sourceId: string, targetId: string, relationType: string): boolean {
        const sourceNode = this.editor.getNodeFromId(sourceId);
        if (!sourceNode) return false;

        return Object.keys(sourceNode.outputs).some(portKey =>
            sourceNode.outputs[portKey].connections.some((conn: any) => {
                if (conn.node.toString() !== targetId.toString()) return false;
                const selector = `svg.connection.node_out_node-${sourceId}.node_in_node-${targetId}`;
                const svg = this.shadowRoot?.querySelector(selector);
                return svg?.classList.contains(relationType) ?? false;
            })
        );
    }

    /** Helper to check if a class already has a composition owner */
    private _hasCompositionOwner(targetId: string): boolean {
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        return Object.keys(allNodes).some(nodeId => {
            const node = allNodes[nodeId];
            return Object.keys(node.outputs || {}).some(portKey =>
                node.outputs[portKey].connections.some((conn: any) => {
                    if (conn.node.toString() !== targetId.toString()) return false;
                    const selector = `svg.connection.node_out_node-${nodeId}.node_in_node-${targetId}`;
                    const svg = this.shadowRoot?.querySelector(selector);
                    return svg?.classList.contains('composition') ?? false;
                })
            );
        });
    }

    /** Helper to detect cycles in composition relations */
    private _detectCompositionCycle(sourceId: string, targetId: string): boolean {
        const queue: string[] = [targetId];
        const visited = new Set<string>();
        visited.add(targetId);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (currentId === sourceId) return true;

            const currentNode = this.editor.getNodeFromId(currentId);
            if (!currentNode) continue;

            Object.keys(currentNode.outputs).forEach(portKey => {
                currentNode.outputs[portKey].connections.forEach((conn: any) => {
                    const nextNodeId = conn.node;
                    const selector = `svg.connection.node_out_node-${currentId}.node_in_node-${nextNodeId}`;
                    const svg = this.shadowRoot?.querySelector(selector);
                    if (svg?.classList.contains('composition') && !visited.has(nextNodeId)) {
                        visited.add(nextNodeId);
                        queue.push(nextNodeId);
                    }
                });
            });
        }
        return false;
    }

    /** Collects all possible validation issues for a new relation between two nodes */
    private _getAllValidationIssues(sourceId: string, targetId: string): RelationValidationIssue[] {
        const issues: RelationValidationIssue[] = [];
        const sourceNode = this.editor.getNodeFromId(sourceId);
        const targetNode = this.editor.getNodeFromId(targetId);
        if (!sourceNode || !targetNode) return issues;
        const sType = sourceNode.data.type;
        const tType = targetNode.data.type;

        // self-relation checks for inheritance and realization
        if (sourceId === targetId) {
            if (this.interactionMode === 'inheritance' || this.interactionMode === 'realization') {
                issues.push({
                    message: this.interactionMode === 'inheritance'
                        ? msg("A class cannot inherit from itself.")
                        : msg("A class cannot realize itself."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            return issues;
        }

        // check rules for inheritance
        if (this.interactionMode === 'inheritance') {
            if (sType === 'enum' || sType === 'record') {
                issues.push({
                    message: msg("Enumerations and records cannot extend other classes."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'annotation') {
                issues.push({
                    message: msg("Annotations cannot extend other classes."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (tType === 'annotation') {
                issues.push({
                    message: msg("Annotations cannot be extended."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'object' || tType === 'object') {
                issues.push({
                    message: msg("Objects cannot participate in inheritance relations."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'interface' && tType !== 'interface') {
                issues.push({
                    message: msg("Interfaces can only extend other interfaces."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType !== 'interface' && tType === 'interface') {
                issues.push({
                    message: msg("Classes cannot extend interfaces. Use realization to implement an interface."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            // duplicate inheritance from the same class
            if (this._hasExistingRelation(sourceId, targetId, 'inheritance')) {
                issues.push({
                    message: msg("This class already inherits from the selected class."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // check rules for realization
        if (this.interactionMode === 'realization') {
            if (tType !== 'interface') {
                issues.push({
                    message: msg("Only interfaces can be realization targets."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'interface') {
                issues.push({
                    message: msg("Interfaces cannot realize other elements. Use inheritance to extend an interface."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'annotation') {
                issues.push({
                    message: msg("Annotations cannot implement interfaces."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'object' || tType === 'object') {
                issues.push({
                    message: msg("Objects cannot participate in realization relations."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // cycle detection for inheritance and realization
        if (this.interactionMode === 'inheritance' || this.interactionMode === 'realization') {
            if (this._detectCycle(sourceId, targetId)) {
                issues.push({
                    message: msg("Inheritance cycles are not allowed."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // composition and aggregation rules
        if (this.interactionMode === 'composition' || this.interactionMode === 'aggregation') {
            const invalidSourceTypes = ['interface', 'enum', 'datatype', 'annotation'];
            const invalidTargetTypes = ['enum', 'datatype', 'annotation'];

            if (invalidSourceTypes.includes(sType)) {
                issues.push({
                    message: msg("Selected class type cannot own compositions or aggregations."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (invalidTargetTypes.includes(tType)) {
                issues.push({
                    message: msg("Selected class type cannot be part of a composition or aggregation."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // composition-specific rules
        if (this.interactionMode === 'composition') {
            if (this._hasCompositionOwner(targetId)) {
                issues.push({
                    message: msg("This class is already part of a composition. A class can only have one owner."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (this._detectCompositionCycle(sourceId, targetId)) {
                issues.push({
                    message: msg("A class cannot directly or indirectly own itself."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // bidirectional association rules
        if (this.interactionMode === 'association-bidirectional') {
            if (sType === 'datatype' || sType === 'enum') {
                issues.push({
                    message: msg("Data types and enumerations cannot be the source of a bidirectional association."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (tType === 'datatype' || tType === 'enum') {
                issues.push({
                    message: msg("Data types and enumerations cannot be the target of a bidirectional association."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // directed association rules
        if (this.interactionMode === 'association') {
            if (sType === 'datatype' || sType === 'enum') {
                issues.push({
                    message: msg("Data types and enumerations cannot be the source of an association."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        return issues;
    }

    /** Filters relation validation issues based on the global validation mode */
    private _activeIssues(sourceId: string, targetId: string): RelationValidationIssue[] {
        return this.globalSettings.activeIssues(this._getAllValidationIssues(sourceId, targetId), this.settings);
    }

    // #################################################################################
    // render() Methode
    // #################################################################################

    render() {
        return html`

            <div 
                id="drawflowEditorDiv" 
                class="${this.interactionMode !== 'idle' ? 'interaction-mode-active' : ''} ${this._isEmpty ? 'empty' : ''}"
            >
                <svg style="position: absolute; width: 0; height: 0;">
                    <defs>${arrowMarkers(2)}</defs>
                </svg>
            </div>

            <canvas-alert
                .hint=${this.interactionMode === 'idle' ? null : this.firstOrSecondClass === 'first'
                    ? msg(html`Select source for <strong>${relationLabel(this.interactionMode, this.diagramType === 'object-diagram')}</strong>.`)
                    : msg(html`Select target for <strong>${relationLabel(this.interactionMode, this.diagramType === 'object-diagram')}</strong>.`)}
                @hint-closed=${() => this._cancelAddRelation()}
            ></canvas-alert>

            ${this._isEmpty ? html`
                <div class="empty-hint">
                    ${this.diagramType === 'object-diagram'
                        ? msg("Add objects via the toolbar above.")
                        : msg("Add classes via the toolbar above.")}
                </div>
            ` : ''}

            <zoom-controls
                .zoomLevel=${this.editor?.zoom ?? 1}
                .minZoom=${this.editor?.zoom_min ?? 0.5}
                .maxZoom=${this.editor?.zoom_max ?? 1.6}
                .isFullscreen=${this.isFullscreen}
                ?zoomDisabled=${this._isEmpty}
                @zoom-in=${() => this.editor.zoom_in()}
                @zoom-out=${() => this.editor.zoom_out()}
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
