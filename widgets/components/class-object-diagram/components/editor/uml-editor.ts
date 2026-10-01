import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { query, state, property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { ClassModel } from "../../models/class-model";
import { ClassDialog } from "../class-object-dialog/class-dialog";
import { ClassSettings } from "../../models/class-settings-model";
import { RelationDialog, RelationDialogData } from "../relation-link-dialog/relation-dialog";
import Drawflow from 'drawflow'
import styles from "./uml-editor.styles";
import { SlButton, SlIcon, SlIconButton } from "@shoelace-style/shoelace";
import xIcon from "@tabler/icons/outline/x.svg";
import { ZoomControls } from "../../../zoom-controls/zoom-controls";
import { GlobalSettings } from "../../../global-settings/global-settings-model";

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
            "sl-icon-button": SlIconButton,
            "zoom-controls": ZoomControls,
            "uml-class-dialog": ClassDialog,
            "uml-relation-dialog": RelationDialog  
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

    /** The diagram data last loaded or sent to the widget, to tell outside changes (e.g. undo/redo) apart from our own edits */
    private _lastEmittedData: string | null = null;

    /** variable to block the doubleclick while adding self-relations */
    private _blockDblClick: boolean = false;

    /* 
    #################################################################################
    Lifecycle and Init
    #################################################################################
    */

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

        // The zoom origin is the canvas center, so the grid offset also depends on the canvas size
        new ResizeObserver(() => this._updateGridBackground(this.editor.canvas_x, this.editor.canvas_y)).observe(this.drawflowEditorDiv);

        // Without any classes there is no reference point, so block panning the empty canvas
        // (captured on the shadow root so Drawflow's own mousedown/touchstart handlers never see it)
        const blockPanWhenEmpty = (e: Event) => {
            if (this._isEmpty && this.drawflowEditorDiv.contains(e.target as Node)) {
                e.stopPropagation();
            }
        };
        this.renderRoot.addEventListener('mousedown', blockPanWhenEmpty, true);
        this.renderRoot.addEventListener('touchstart', blockPanWhenEmpty, true);

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
                    'realization', 
                    'self-relation'
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
            
            requestAnimationFrame(() => {
                this.updateNodeVisuals(selectedId);
            });
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

                Object.keys(nodes).forEach(sourceId => {
                    const sourceNode = nodes[sourceId];
                    if (sourceNode.outputs) {
                        Object.keys(sourceNode.outputs).forEach(outputKey => {
                            const connections = sourceNode.outputs[outputKey].connections;
                            connections.forEach((conn: any) => {
                                const targetId = conn.node.toString();
                                const inPort = conn.output;
                                const connectionId = `node_in_node-${targetId}_node_out_node-${sourceId}_${outputKey}_${inPort}`;
                                this.renderRelationLabels(connectionId);
                            });
                        });
                    }
                });

                Object.keys(nodes).forEach(nodeId => {
                    this.updateNodeVisuals(nodeId);
                });

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
            alert(msg("Maximal number of classes reached!"));
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
            alert(msg("Maximal number of relations reached!"));
            return;
        }

        // initialize states for the "relation mode"
        this.interactionMode = relationType as InteractionType;
        this.relationSourceNodeId = null;
        this.firstOrSecondClass = 'first';

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
                this.handleWrongSelection(msg("Maximal number of relations between these classes reached!"));
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
        alert(errorText);
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

        // Wait for the DOM to be ready before adding a new connection
        requestAnimationFrame(() => {
            this.editor.addConnection(nodeId, proxyId, outPort, inPort);

            // Wait for the new conncection to be created before processing visual updates
            requestAnimationFrame(() => {
                // retry up to 5 frames to ensure DOM elements are ready for visual updates
                let attempts = 0;
                const maxAttempts = 5;

                const tryUpdate = () => {
                    attempts++;
                    
                    try {
                        this.updateNodeVisuals(nodeId);
                        const success = this.updatePortPositions(nodeId, proxyId.toString(), outPort, inPort);
                        if (success) {
                            const selector = `svg.connection.node_out_node-${nodeId}.node_in_node-${proxyId}.${outPort}.${inPort}`;
                            const connectionSvg = this.shadowRoot?.querySelector(selector);
                            
                            if (connectionSvg) {
                                connectionSvg.classList.add(currentConnectionType);
                                connectionSvg.classList.add('self-relation');
                                this._saveConnectionType(nodeId, proxyId.toString(), inPort, currentConnectionType);
                                const connectionId = `node_in_node-${proxyId}_node_out_node-${nodeId}_${outPort}_${inPort}`;
                                this.renderRelationLabels(connectionId);
                                this._serializeAndEmit(); 
                            } else {
                                const allPossible = this.shadowRoot?.querySelectorAll(`svg.connection.node_out_node-${nodeId}.node_in_node-${proxyId}`);
                                allPossible?.forEach(svg => {
                                    if (svg.classList.contains(outPort) && svg.classList.contains(inPort)) {
                                        svg.classList.add(currentConnectionType);
                                        svg.classList.add('self-relation');
                                        this._saveConnectionType(nodeId, proxyId.toString(), inPort, currentConnectionType);
                                        const connectionId = `node_in_node-${proxyId}_node_out_node-${nodeId}_${outPort}_${inPort}`;
                                        this.renderRelationLabels(connectionId); 
                                        this._serializeAndEmit(); 
                                    }
                                });
                            }
                        }
                        // correct self relation paths
                        this._forceSelfRelationPaths();
                    } catch (e) {
                        // ignore temporary errors during DOM rendering, next frame will retry
                    }
                    if (attempts < maxAttempts) {
                        requestAnimationFrame(tryUpdate);
                    }
                };
                tryUpdate();
            });
        });
    }

    /** Finaly add the new relaiton at the end of the creation and placing process */
    private _finalizeRelation(sourceId: string, targetId: string) {
        
        // create ports
        const outPort = this._addPort(sourceId, 'output');
        const inPort = this._addPort(targetId, 'input');

        // Save the connection type before canceling the relation mode (which resets interactionMode to 'idle')
        const currentConnectionType = this.interactionMode;
        this._cancelAddRelation();

        // create connection at the next frame when the DOM is ready
        requestAnimationFrame(() => {
            this.editor.addConnection(sourceId, targetId, outPort, inPort);

            // start visual update of the editor (but wait for the new connection to be created before)
            requestAnimationFrame(() => {
                // retry up to 5 frames to ensure DOM elements are ready for visual updates
                let attempts = 0;
                const maxAttempts = 5;

                const tryUpdate = () => {
                    attempts++;
                    
                    try {
                        // update for all nodes to trigger port correction
                        this.updateNodeVisuals(sourceId);
                        this.updateNodeVisuals(targetId);
                        const success = this.updatePortPositions(sourceId, targetId, outPort, inPort);

                        if (success) {
                            const selector = `svg.connection.node_out_node-${sourceId}.node_in_node-${targetId}.${outPort}.${inPort}`;
                            const connectionSvg = this.shadowRoot?.querySelector(selector);
                            
                            if (connectionSvg) {
                                connectionSvg.classList.add(currentConnectionType);
                                this._saveConnectionType(sourceId, targetId, inPort, currentConnectionType);
                                this._serializeAndEmit();
                            } else {
                                // Fallback
                                const allPossible = this.shadowRoot?.querySelectorAll(`svg.connection.node_out_node-${sourceId}.node_in_node-${targetId}`);
                                allPossible?.forEach(svg => {
                                    if (svg.classList.contains(outPort) && svg.classList.contains(inPort)) {
                                        svg.classList.add(currentConnectionType);
                                        this._saveConnectionType(sourceId, targetId, inPort, currentConnectionType);
                                        this._serializeAndEmit();
                                    }
                                });
                            }

                            // render labels and self relations corrctly
                            const connectionId = `node_in_node-${targetId}_node_out_node-${sourceId}_${outPort}_${inPort}`;
                            this.renderRelationLabels(connectionId);
                            this._forceSelfRelationPaths();
                        }
                    } catch (e) {
                        // Just do nothing, the next frame will fix it
                    }

                    if (attempts < maxAttempts) {
                        requestAnimationFrame(tryUpdate);
                    }
                };
                tryUpdate();
            });
        });
    }

    /** End the "relation mode" adding relations process due to canceling or just to reset environment after adding relation */
    private _cancelAddRelation() {
        // Resetting the mode and associated variables
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
                    connection.data = {
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
                            ? m.parameters.map(p => `${p.name} ${p.type}`).join(", ")
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

    /** Update the positions of the ports when node is moved or the relation is created */
    private updatePortPositions(outputNodeId: string, inputNodeId: string, outputPort: string, inputPort: string): boolean {
        // Check if still existent
        if (!this.editor.getNodeFromId(outputNodeId) || !this.editor.getNodeFromId(inputNodeId)) {
            return false;
        }

        // Calculate the best port positions
        const positions = this._calculateOptimalPortPositionsWithIds(outputNodeId, inputNodeId, outputPort, inputPort);
        if (!positions) return false;

        // Get HTML Elements
        const selectorIn = `#node-${outputNodeId} .${outputPort}`;
        const selectorOut = `#node-${inputNodeId} .${inputPort}`;
        const inNode = this.shadowRoot?.querySelector(selectorIn) as HTMLElement;
        const outNode = this.shadowRoot?.querySelector(selectorOut) as HTMLElement;

        // Return false if no element is found (happens if DOM is not ready yet)
        if (!inNode || !outNode) return false;

        if (inNode) {
            inNode.style.left = `${positions.portOut.x}px`;
            inNode.style.top = `${positions.portOut.y}px`;
        }

        if (outNode) {
            outNode.style.left = `${positions.portIn.x}px`;
            outNode.style.top = `${positions.portIn.y}px`;
            outNode.style.transform = 'none';
        }

        // update relations (visible lines)
        try {
            this.editor.updateConnectionNodes(`node-${outputNodeId}`);
            this.editor.updateConnectionNodes(`node-${inputNodeId}`);
        } catch (e) {
            // ignore errors in drawflow because the next loop will fix it
            return false;
        }

        const connectionSelector = `svg.connection.node_out_node-${outputNodeId}.node_in_node-${inputNodeId}.${outputPort}.${inputPort}`;
        const connectionSvg = this.shadowRoot?.querySelector(connectionSelector) as SVGElement;
        
        if (connectionSvg) {
            // Ensure that the hitbox (backpath) exist
            this._ensureBackPath(connectionSvg);

            const mainPath = connectionSvg.querySelector('.main-path') as SVGPathElement;
            const backPath = connectionSvg.querySelector('.back-path') as SVGPathElement;

            // synchronize path and hitbox (backpath)
            if (mainPath && backPath) {
                // Different logic for self-relations
                if (connectionSvg.classList.contains('self-relation')) {
                    const outNodeData = this.editor.getNodeFromId(outputNodeId);
                    const inNodeData = this.editor.getNodeFromId(inputNodeId);

                    // calculate position
                    const startX = outNodeData.pos_x + positions.portOut.x + 3;
                    const startY = outNodeData.pos_y + positions.portOut.y + 3;
                    const endX = inNodeData.pos_x + positions.portIn.x + 3;
                    const endY = inNodeData.pos_y + positions.portIn.y + 3;

                    const curveX = startX - 40; 
                    const pathData = `M ${startX} ${startY} L ${curveX} ${startY} L ${curveX} ${endY} L ${endX} ${endY}`;

                    // set both paths manually (overwrite default)
                    mainPath.setAttribute('d', pathData);
                    backPath.setAttribute('d', pathData);
                
                } else {
                    // apply standard for non selfconnections
                    const d = mainPath.getAttribute('d');
                    if (d) backPath.setAttribute('d', d);
                }
            }
        }
        return true;
    }

    /** forces right path for self-relations (apply after each creation and node move events to overwrite standard) */
    private _forceSelfRelationPaths() {
        const selfRelationSvgs = this.shadowRoot?.querySelectorAll('svg.connection.self-relation') as NodeListOf<SVGElement>;

        selfRelationSvgs?.forEach(svg => {
            const mainPath = svg.querySelector('.main-path') as SVGPathElement;
            const backPath = svg.querySelector('.back-path') as SVGPathElement;
            const classList = Array.from(svg.classList);
            const nodeOutClass = classList.find(c => c.startsWith('node_out_node-'));
            const nodeInClass = classList.find(c => c.startsWith('node_in_node-'));
            const outPortId = classList.find(c => c.startsWith('output_'));
            const inPortId = classList.find(c => c.startsWith('input_'));

            if (nodeOutClass && nodeInClass && outPortId && inPortId) {
                const outNodeId = nodeOutClass.replace('node_out_node-', '');
                const inNodeId = nodeInClass.replace('node_in_node-', '');

                const outNodeData = this.editor.getNodeFromId(outNodeId);
                const inNodeData = this.editor.getNodeFromId(inNodeId);

                if (outNodeData && inNodeData) {
                    const positions = this._calculateOptimalPortPositionsWithIds(outNodeId, inNodeId, outPortId, inPortId);
                    
                    if (positions) {
                        const startX = outNodeData.pos_x + positions.portOut.x + 3;
                        const startY = outNodeData.pos_y + positions.portOut.y + 3;
                        const endX = inNodeData.pos_x + positions.portIn.x + 3;
                        const endY = inNodeData.pos_y + positions.portIn.y + 3;
                        const curveX = startX - 40; 
                        const pathData = `M ${startX} ${startY} L ${curveX} ${startY} L ${curveX} ${endY} L ${endX} ${endY}`;

                        // fix arrowhead after reload
                        const types = ['association', 'inheritance', 'composition', 'aggregation', 'dependency', 'realization'];
                        const relType = classList.find(c => types.includes(c)) || 'association';
                        const markerMap: Record<string, string> = {
                            'association': 'url(#arrow-association)',
                            'inheritance': 'url(#arrow-inheritance)',
                            'realization': 'url(#arrow-realization)',
                            'dependency': 'url(#arrow-dependency)',
                            'aggregation': 'url(#arrow-aggregation)',
                            'composition': 'url(#arrow-composition)',
                        };
                        if (mainPath) {
                            mainPath.setAttribute('d', pathData);
                            mainPath.setAttribute('marker-end', markerMap[relType] || 'url(#arrow-association)');
                        }

                        if (backPath) backPath.setAttribute('d', pathData);
                    }
                }
            }
        });
    }

    /** calculate optimal portpositions */
    private _calculateOptimalPortPositionsWithIds(outNodeId: string, inNodeId: string, outputPortId: string, inputPortId: string) {
        const outputNode = this.editor.getNodeFromId(outNodeId);
        const inputNode = this.editor.getNodeFromId(inNodeId);
        
        if (!outputNode || !inputNode) {
            return null;
        }

        const outNodeHTML = this.shadowRoot?.querySelector(`#node-${outNodeId}`) as HTMLElement;
        const inNodeHTML = this.shadowRoot?.querySelector(`#node-${inNodeId}`) as HTMLElement;
        
        if (!inNodeHTML || !outNodeHTML) {
            return null;
        }

        if (outNodeHTML.offsetWidth <= 0 || inNodeHTML.offsetWidth <= 0) {
            return null;
        }

        const widthInNode = inNodeHTML.offsetWidth;
        const heightInNode = inNodeHTML.offsetHeight;
        const widthOutNode = outNodeHTML.offsetWidth;
        const heightOutNode = outNodeHTML.offsetHeight;

        const allConnections = this._getAllConnectionsBetween(outNodeId, inNodeId);
        const currentConnId = `node_in_node-${inNodeId}_node_out_node-${outNodeId}_${outputPortId}_${inputPortId}`;
        
        let connectionIndex = allConnections.indexOf(currentConnId);
        if (connectionIndex === -1) {
            connectionIndex = 0;
        }
        
        const totalConnections = allConnections.length;

        // different logic for self relations and their proxys
        const isSelfRelation = inputNode.data && inputNode.data.isProxy && inputNode.data.parentNodeId === outNodeId;
        if (isSelfRelation) {
            const allNodes = this.editor.drawflow.drawflow.Home.data;
            const myProxies = Object.values(allNodes).filter((n: any) => 
                n.data.isProxy && n.data.parentNodeId === outNodeId
            ).sort((a: any, b: any) => parseInt(a.id) - parseInt(b.id));

            const proxyIndex = myProxies.findIndex((n: any) => n.id.toString() === inNodeId.toString());
            const totalProxies = myProxies.length;
            const factor = (proxyIndex + 1) / (totalProxies + 1);
            const centerY = heightOutNode * factor;
            const spread = 40; 
            const pOutY = Math.max(0, centerY - (spread / 2));
            
            return {
                portOut: { x: -3, y: pOutY - 3 },
                portIn:  { x: 50 - 3, y: spread - 3 }
            };
        }

        const outX = outputNode.pos_x;
        const outY = outputNode.pos_y;
        const inX = inputNode.pos_x;
        const inY = inputNode.pos_y;

        const outRight = outX + widthOutNode;
        const outBottom = outY + heightOutNode;
        const inRight = inX + widthInNode;
        const inBottom = inY + heightInNode;

        const xOverlap = Math.max(0, Math.min(outRight, inRight) - Math.max(outX, inX));
        const yOverlap = Math.max(0, Math.min(outBottom, inBottom) - Math.max(outY, inY));

        const outCenter = { x: outX + widthOutNode / 2, y: outY + heightOutNode / 2 };
        const inCenter = { x: inX + widthInNode / 2, y: inY + heightInNode / 2 };

        let portOut = { x: 0, y: 0 };
        let portIn = { x: 0, y: 0 };

        const calculateAlignedPosition = (sourceLen: number, sourcePos: number, targetLen: number, targetPos: number) => {
            const gap = sourceLen / (totalConnections + 1);
            const startOverlap = Math.max(sourcePos, targetPos);
            const endOverlap = Math.min(sourcePos + sourceLen, targetPos + targetLen);

            let idealAbsoluteCenter: number;

            if (startOverlap < endOverlap) {
                idealAbsoluteCenter = (startOverlap + endOverlap) / 2;
            } else {
                if (targetPos >= sourcePos + sourceLen) {
                    idealAbsoluteCenter = sourcePos + sourceLen;
                } else {
                    idealAbsoluteCenter = sourcePos;
                }
            }

            const idealLocalCenter = idealAbsoluteCenter - sourcePos;
            const centerOffsetIndex = connectionIndex - (totalConnections - 1) / 2;
            const posFromCenter = centerOffsetIndex * gap;
            
            const halfGroupWidth = ((totalConnections - 1) * gap) / 2;
            const margin = 10; 
            const minCenter = halfGroupWidth + margin;
            const maxCenter = sourceLen - halfGroupWidth - margin;
            
            const clampedCenter = Math.max(minCenter, Math.min(maxCenter, idealLocalCenter));

            return clampedCenter + posFromCenter;
        };
        
        const dx = Math.abs(outCenter.x - inCenter.x);
        const dy = Math.abs(outCenter.y - inCenter.y);

        if (xOverlap > 0 && xOverlap > yOverlap) {
            portOut.x = calculateAlignedPosition(widthOutNode, outX, widthInNode, inX);
            portIn.x = calculateAlignedPosition(widthInNode, inX, widthOutNode, outX);

            if (outCenter.y < inCenter.y) {
                portOut.y = heightOutNode; 
                portIn.y = 0;              
            } else {
                portOut.y = 0;             
                portIn.y = heightInNode;   
            }

        } else if (yOverlap > 0 && yOverlap > xOverlap) {
            portOut.y = calculateAlignedPosition(heightOutNode, outY, heightInNode, inY);
            portIn.y = calculateAlignedPosition(heightInNode, inY, heightOutNode, outY);

            if (outCenter.x < inCenter.x) {
                portOut.x = widthOutNode; 
                portIn.x = 0;             
            } else {
                portOut.x = 0;            
                portIn.x = widthInNode;   
            }

        } else {
            if (dx > dy) {
                portOut.y = calculateAlignedPosition(heightOutNode, outY, heightInNode, inY);
                portIn.y = calculateAlignedPosition(heightInNode, inY, heightOutNode, outY);

                if (outCenter.x < inCenter.x) {
                    portOut.x = widthOutNode;
                    portIn.x = 0;
                } else {
                    portOut.x = 0;
                    portIn.x = widthInNode;
                }
            } else {
                portOut.x = calculateAlignedPosition(widthOutNode, outX, widthInNode, inX);
                portIn.x = calculateAlignedPosition(widthInNode, inX, widthOutNode, outX);

                if (outCenter.y < inCenter.y) {
                    portOut.y = heightOutNode;
                    portIn.y = 0;
                } else {
                    portOut.y = 0;
                    portIn.y = heightInNode;
                }
            }
        }

        portOut.x = Math.max(0, Math.min(widthOutNode, portOut.x));
        portOut.y = Math.max(0, Math.min(heightOutNode, portOut.y));
        portIn.x = Math.max(0, Math.min(widthInNode, portIn.x));
        portIn.y = Math.max(0, Math.min(heightInNode, portIn.y));

        portOut.x -= 3;
        portOut.y -= 3;
        portIn.x -= 3;
        portIn.y -= 3;

        return { portOut, portIn };
    }

    /** Helper function to get all relations between two nodes */
    private _getAllConnectionsBetween(nodeId1: string, nodeId2: string): string[] {
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const connections: string[] = [];

        // search for one direction
        const node1 = allNodes[nodeId1];
        if (node1 && node1.outputs) {
             Object.keys(node1.outputs).forEach(outKey => {
                 node1.outputs[outKey].connections.forEach((conn: any) => {
                     if (conn.node.toString() === nodeId2.toString()) {
                         const connId = `node_in_node-${nodeId2}_node_out_node-${nodeId1}_${outKey}_${conn.output}`;
                         connections.push(connId);
                     }
                 });
             });
        }

        // search for the opposite direction
        if (nodeId1 !== nodeId2) {
            const node2 = allNodes[nodeId2];
            if (node2 && node2.outputs) {
                Object.keys(node2.outputs).forEach(outKey => {
                    node2.outputs[outKey].connections.forEach((conn: any) => {
                        if (conn.node.toString() === nodeId1.toString()) {
                            const connId = `node_in_node-${nodeId1}_node_out_node-${nodeId2}_${outKey}_${conn.output}`;
                            connections.push(connId);
                        }
                    });
                });
            }
        }

        // sort, so that the order remains the same for each new calculation
        return connections.sort();
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
        const sourceNode = this.editor.getNodeFromId(sourceNodeId);
        const targetNode = this.editor.getNodeFromId(targetNodeId);

        if (!sourceNode || !targetNode) return;

        const outputPortId = partsForSelector[6] + '_' + partsForSelector[7];
        const inputPortId = partsForSelector[8] + '_' + partsForSelector[9];

        // get the port positions
        const portPositions = this._calculateOptimalPortPositionsWithIds(sourceNodeId, targetNodeId, outputPortId, inputPortId);
        
        if (!portPositions) return;

        const xOutputNode = sourceNode.pos_x + portPositions.portOut.x;
        const yOutputNode = sourceNode.pos_y + portPositions.portOut.y;
        const xInputNode = targetNode.pos_x + portPositions.portIn.x;
        const yInputNode = targetNode.pos_y + portPositions.portIn.y;

        let sourceMultiX, sourceMultiY, targetMultiX, targetMultiY, nameLabelX, nameLabelY;
        
        let sourceAnchor: 'start' | 'end' = 'start';
        let targetAnchor: 'start' | 'end' = 'end';

        let nameOffset = { x: 0, y: 5 };

        const isSelfRelation = targetNode.data && targetNode.data.isProxy && targetNode.data.parentNodeId === sourceNodeId;
        if (isSelfRelation) {
            // calculate label positions for selfrelations
            sourceAnchor = 'end';
            targetAnchor = 'end';

            const curveOffset = 40;
            const verticalBarX = xOutputNode - curveOffset; 
            const verticalCenterY = (yOutputNode + yInputNode) / 2;

            sourceMultiX = xOutputNode - 15; 
            sourceMultiY = yOutputNode - 10; 
            
            targetMultiX = xInputNode - 15; 
            targetMultiY = yInputNode + 20; 

            nameLabelX = verticalBarX;
            nameLabelY = verticalCenterY;
            nameOffset = { x: -30, y: 5 };

        } else {
            // calculate label positions for the regular case
            const dx = xInputNode - xOutputNode;
            const dy = yInputNode - yOutputNode;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if(length == 0) return;

            const normalX = -(dy / length);
            const normalY = dx / length;

            let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
            const side = (angle >= 90 && angle < 270) ? 1 : -1;

            const baseOffsetX = normalX * 30 * side;
            const baseOffsetY = normalY * 30 * side;

            // decides the direction of the label 'growing'
            const nodeDx = targetNode.pos_x - sourceNode.pos_x;
            const nodeDy = targetNode.pos_y - sourceNode.pos_y;
            
            if (Math.abs(nodeDx) >= Math.abs(nodeDy)) {
                // fix to prevent the label von crossing the connection line
                if (baseOffsetX < -1) {
                    sourceAnchor = 'end';
                    targetAnchor = 'end';
                } else if (baseOffsetX > 1) {
                    sourceAnchor = 'start';
                    targetAnchor = 'start';
                } else {
                    if (xOutputNode < xInputNode) {
                        sourceAnchor = 'start';
                        targetAnchor = 'end';
                    } else {
                        sourceAnchor = 'end';
                        targetAnchor = 'start';
                    }
                }
            } else {
                const isPushedLeft = (normalX * side) < 0;

                if (isPushedLeft) {
                    sourceAnchor = 'end';
                    targetAnchor = 'end';
                } else {
                    sourceAnchor = 'start';
                    targetAnchor = 'start';
                }
            }

            const distance = Math.max(Math.min(length * 0.1, 30), 20);

            const midX = (xOutputNode + xInputNode) / 2;
            const midY = (yOutputNode + yInputNode) / 2;

            sourceMultiX = xOutputNode + ((dx / length) * distance) + baseOffsetX;
            sourceMultiY = yOutputNode + ((dy / length) * distance) + baseOffsetY;

            targetMultiX = xInputNode - ((dx / length) * distance) + baseOffsetX;
            targetMultiY = yInputNode - ((dy / length) * distance) + baseOffsetY;
            
            nameLabelX = midX + baseOffsetX;
            nameLabelY = midY + baseOffsetY;

            if (yOutputNode > yInputNode) {
                sourceMultiY -= 15;
            } else if (yInputNode > yOutputNode) {
                targetMultiY -= 15;
            }
        }

        // get the data for the connection
        const connectionData = this.editor.drawflow.drawflow['Home'].data[sourceNodeId]
            ?.outputs[outputPortId]
            ?.connections
            ?.find((c: any) => c.node.toString() === targetNodeId.toString() && c.output === inputPortId)?.data;

        if (!connectionData) return;

        let sourceMultiplicity = connectionData.sourceMultiplicity || '';
        let targetMultiplicity = connectionData.targetMultiplicity || '';
        let sourceRole = connectionData.sourceRole || '';
        let targetRole = connectionData.targetRole || '';
        let relationName = connectionData.relationName || '';

        // get the svg element of the connection
        const selector = `svg.connection.node_out_node-${sourceNodeId}.node_in_node-${targetNodeId}.${outputPortId}.${inputPortId}`;
        const svgElement = this.shadowRoot?.querySelector(selector) as SVGElement;
        
        if (!svgElement) return;
        
        // Add the labels
        const multiOffset = { x: 0, y: 5 };
        const roleOffset = { x: 0, y: 20 };
        // source multiplicity
        this.updateText('label-source',
                        sourceMultiplicity,
                        sourceMultiX,
                        sourceMultiY,
                        svgElement,
                        multiOffset,
                        sourceAnchor);
        // target multiplicity
        this.updateText('label-target',
                        targetMultiplicity,
                        targetMultiX,
                        targetMultiY,
                        svgElement,
                        multiOffset,
                        targetAnchor);
        // source role
        this.updateText('label-source-role',
                        sourceRole,
                        sourceMultiX,
                        sourceMultiY,
                        svgElement,
                        roleOffset,
                        sourceAnchor);
        // target role
        this.updateText('label-target-role',
                        targetRole,
                        targetMultiX,
                        targetMultiY,
                        svgElement,
                        roleOffset,
                        targetAnchor);
        // relation name
        this.updateText('label-name',
                        relationName,
                        nameLabelX,
                        nameLabelY,
                        svgElement,
                        nameOffset,
                        'middle');
    }

    /** 
     * Central update method called after every node move or diagram load
     * Updates association class lines, repositions proxy nodes for self-relations,
     * recalculates all port positions and connection lines, and corrects self-relation paths
     */
    private updateNodeVisuals(nodeId: string) {
        const movedNode = this.editor.getNodeFromId(nodeId);
        if (!movedNode) return;

        // update asscociation class line to association
        if (movedNode.data && movedNode.data.associatedConnectionId) {
            this._updateAssociationClassLine(nodeId);
        } 

        // update proxy positioning
        const allNodes = this.editor.drawflow.drawflow.Home.data;
        const myProxies = Object.values(allNodes).filter((n: any) => 
            n.data.isProxy && n.data.parentNodeId === nodeId
        ).sort((a: any, b: any) => parseInt(a.id) - parseInt(b.id));
        const nodeEl = this.shadowRoot?.querySelector(`#node-${nodeId}`) as HTMLElement;
        const heightNode = nodeEl?.offsetHeight || 100;
        myProxies.forEach((proxyData: any, index: number) => {
            const proxyId = proxyData.id;
            const proxyEl = this.shadowRoot?.querySelector(`#node-${proxyId}`) as HTMLElement;

            if (proxyEl) {
                const totalProxies = myProxies.length;
                const factor = (index + 1) / (totalProxies + 1);
                const centerY = heightNode * factor;
                const spread = 40;

                const newX = movedNode.pos_x - 50;
                
                const newY = movedNode.pos_y + centerY - (spread / 2);

                this.editor.drawflow.drawflow.Home.data[proxyId].pos_x = newX;
                this.editor.drawflow.drawflow.Home.data[proxyId].pos_y = newY;

                proxyEl.style.left = newX + "px";
                proxyEl.style.top = newY + "px";

                this.editor.updateConnectionNodes(`node-${proxyId}`);
            }
        });

        // update relations and ports
        const allConnections = this.getNodeConnectionsById(nodeId);
        allConnections.forEach(connectionId => {
            const parts = connectionId.split('_');
            const targetId = parts[2].replace('node-', '');
            const sourceId = parts[5].replace('node-', '');
            const outPortName = parts[6] + '_' + parts[7]; 
            const inPortName = parts[8] + '_' + parts[9];  

            this.updatePortPositions(sourceId, targetId, outPortName, inPortName);

            const targetNode = this.editor.getNodeFromId(targetId);
            if (targetNode && targetNode.data.isProxy && targetNode.data.parentNodeId === sourceId) {
                 const selector = `svg.connection.node_out_node-${sourceId}.node_in_node-${targetId}.${outPortName}.${inPortName}`;
                 const connectionSvg = this.shadowRoot?.querySelector(selector);
                 if (connectionSvg && !connectionSvg.classList.contains('self-relation')) {
                     connectionSvg.classList.add('self-relation');
                 }
            }

            this.renderRelationLabels(connectionId);
            this._updateRelatedAssociationClass(connectionId);
        });

        // correct pathes of self relations
        this._forceSelfRelationPaths();
    }

    /** Helper method to create or update text elements */
    private updateText(
        className: string, 
        content: string, 
        x: number, 
        y: number, 
        svgElement: SVGElement,
        offset: { x: number, y: number } = { x: 0, y: 0 },
        textAnchor: 'start' | 'middle' | 'end' = 'middle'
        ) {
        
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
        textEl.setAttribute('x', (x + offset.x).toString());
        textEl.setAttribute('y', (y + offset.y).toString());
        
        // text-anchor controls the alignment point of the SVG text relative to its x coordinate
        // 'start' = grows right, 'middle' = centered, 'end' = grows left
        textEl.setAttribute('text-anchor', textAnchor);
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

        const mid = this.getMiddleOfConnection(connectionId);
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

    /** Helper method to get the middle point of a relation */
    private getMiddleOfConnection(connectionId: string) {
        const partsForSelector = connectionId.split('_');

        const sourceNodeId = partsForSelector[5].replace('node-', '');
        const targetNodeId = partsForSelector[2].replace('node-', '');

        const sourceNode = this.editor.getNodeFromId(sourceNodeId);
        const targetNode = this.editor.getNodeFromId(targetNodeId);

        const outputPortId = partsForSelector[6] + '_' + partsForSelector[7];
        const inputPortId = partsForSelector[8] + '_' + partsForSelector[9];

        const portPositions = this._calculateOptimalPortPositionsWithIds(sourceNodeId, targetNodeId, outputPortId, inputPortId);
        const xOutputNode = sourceNode.pos_x + portPositions.portOut.x;
        const yOutputNode = sourceNode.pos_y + portPositions.portOut.y;
        const xInputNode = targetNode.pos_x + portPositions.portIn.x;
        const yInputNode = targetNode.pos_y + portPositions.portIn.y;

        const midX = (xOutputNode + xInputNode) / 2;
        const midY = (yOutputNode + yInputNode) / 2;

        const mid = {x: midX, y: midY}

        return mid;
    }

    /** create a new Assertion class and draw a line to the middle of the connection */
    private _addAssociationClass(connectionId: string) {
        if (!this.editor) return;

        // check for constraints
        if (this._getClassCount() >= this.settings.maxClasses) {
            alert(msg("Maximal number of classes reached!"));
            return;
        }

        // calculate the middle-point of the association
        // getMiddleOfConnection() is not used here because we also need the individual
        // port positions to calculate the placement of the new association class
        const partsForSelector = connectionId.split('_');

        const sourceNodeId = partsForSelector[5].replace('node-', '');
        const targetNodeId = partsForSelector[2].replace('node-', '');

        const sourceNode = this.editor.getNodeFromId(sourceNodeId);
        const targetNode = this.editor.getNodeFromId(targetNodeId);

        const outputPortId = partsForSelector[6] + '_' + partsForSelector[7];
        const inputPortId = partsForSelector[8] + '_' + partsForSelector[9];

        const portPositions = this._calculateOptimalPortPositionsWithIds(sourceNodeId, targetNodeId, outputPortId, inputPortId);
        
        if (!portPositions) return;

        const xOutputNode = sourceNode.pos_x + portPositions.portOut.x;
        const yOutputNode = sourceNode.pos_y + portPositions.portOut.y;
        const xInputNode = targetNode.pos_x + portPositions.portIn.x;
        const yInputNode = targetNode.pos_y + portPositions.portIn.y;

        const midX = (xOutputNode + xInputNode) / 2;
        const midY = (yOutputNode + yInputNode) / 2;

        const xDiff = Math.abs(Math.abs(xOutputNode) - Math.abs(xInputNode));
        const yDiff = Math.abs(Math.abs(yOutputNode) - Math.abs(yInputNode));
        let centerX = midX;
        let centerY = midY;
        
        if (xDiff > yDiff) {
            centerY = midY + 100;
        } else {
            if (xOutputNode > xInputNode){
                centerX = midX - 250;
            } else  {
                centerX = midX + 100;
            }
        }

        // initialize new class
        const nodeData: ClassModel = {
            type: 'standard',
            name: "New Association Class",
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
                    message: msg("It is not allowed to create a " + this.interactionMode + " to the node itself!"),
                    settingKey: 'checkRelationalLogic'
                });
            }
            return issues;
        }

        // check rules for inheritance
        if (this.interactionMode === 'inheritance') {
            if (sType === 'enum' || sType === 'record') {
                issues.push({
                    message: msg("Enums and Records cannot extend other classes."),
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
                    message: msg("Interfaces can only extend other Interfaces."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType !== 'interface' && tType === 'interface') {
                issues.push({
                    message: msg("Classes cannot extend Interfaces. Please use 'Realization' (Implements)."),
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
                    message: msg("Realization is only possible towards an Interface."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (sType === 'interface') {
                issues.push({
                    message: msg("Interfaces cannot implement. Please use 'Inheritance' (Extends)."),
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
                    message: msg("Cycle detected! Inheritance cycles are not allowed."),
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
                    message: msg("Composition cycle detected! A class cannot directly or indirectly own itself."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // bidirectional association rules
        if (this.interactionMode === 'association-bidirectional') {
            if (sType === 'datatype' || sType === 'enum') {
                issues.push({
                    message: msg("DataTypes and Enums cannot be source of a bidirectional association."),
                    settingKey: 'checkRelationalLogic'
                });
            }
            if (tType === 'datatype' || tType === 'enum') {
                issues.push({
                    message: msg("DataTypes and Enums cannot be target of a bidirectional association."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        // directed association rules
        if (this.interactionMode === 'association') {
            if (sType === 'datatype' || sType === 'enum') {
                issues.push({
                    message: msg("DataTypes and Enums cannot be the source of an association."),
                    settingKey: 'checkRelationalLogic'
                });
            }
        }

        return issues;
    }

    /** Filters relation validation issues based on the global validation mode */
    private _activeIssues(sourceId: string, targetId: string): RelationValidationIssue[] {
        const allIssues = this._getAllValidationIssues(sourceId, targetId);

        if (this.globalSettings.validationMode === 'off') return [];
        if (this.globalSettings.validationMode === 'all') return allIssues;

        return allIssues.filter(issue =>
            (this.settings as any)[issue.settingKey] === true
        );
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
                    <!-- arrow heads use the color of their line (context-stroke), so they follow hover/selection -->
                    <defs>
                        <marker 
                            id="arrow-inheritance" 
                            viewBox="0 0 10 10" 
                            refX="10" 
                            refY="5" 
                            markerWidth="12" 
                            markerHeight="12" 
                            orient="auto">
                            <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sl-color-neutral-0)" stroke="context-stroke" stroke-width="1" />
                        </marker>

                        <marker 
                            id="arrow-realization" 
                            viewBox="0 0 10 10" 
                            refX="10" 
                            refY="5" 
                            markerWidth="12" 
                            markerHeight="12" 
                            orient="auto">
                            <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--sl-color-neutral-0)" stroke="context-stroke" stroke-width="1" />
                        </marker>

                        <marker 
                            id="arrow-association" 
                            viewBox="0 0 10 10" 
                            refX="10" 
                            refY="5" 
                            markerWidth="8" 
                            markerHeight="8" 
                            orient="auto">
                            <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="context-stroke" stroke-width="1.5" />
                        </marker>

                        <marker 
                            id="arrow-association-reverse" 
                            viewBox="0 0 10 10" 
                            refX="0" 
                            refY="5" 
                            markerWidth="8" 
                            markerHeight="8" 
                            orient="auto">
                            <path d="M 10 0 L 0 5 L 10 10" fill="none" stroke="context-stroke" stroke-width="1.5" />
                        </marker>

                        <marker 
                            id="arrow-dependency" 
                            viewBox="0 0 10 10" 
                            refX="10" 
                            refY="5" 
                            markerWidth="8" 
                            markerHeight="8" 
                            orient="auto">
                            <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="context-stroke" stroke-width="1.5" />
                        </marker>

                        <marker 
                            id="arrow-aggregation" 
                            viewBox="0 0 12 10" 
                            refX="12" 
                            refY="5" 
                            markerWidth="10" 
                            markerHeight="10" 
                            orient="auto">
                            <path d="M 0 5 L 6 0 L 12 5 L 6 10 Z" fill="var(--sl-color-neutral-0)" stroke="context-stroke" stroke-width="1" />
                        </marker>

                        <marker 
                            id="arrow-composition" 
                            viewBox="0 0 12 10" 
                            refX="12" 
                            refY="5" 
                            markerWidth="10" 
                            markerHeight="10" 
                            orient="auto">
                            <path d="M 0 5 L 6 0 L 12 5 L 6 10 Z" fill="context-stroke" stroke="context-stroke" stroke-width="1" />
                        </marker>
                    </defs>
                </svg>
            </div>

            ${this.interactionMode !== 'idle' ? html`
                <div class="interaction-banner">
                    <sl-icon name="info-circle"></sl-icon>
                    <span>
                        ${this.firstOrSecondClass === 'first' ? 'Select Source: ' : 'Select Target: '}
                        <strong>${this.interactionMode}</strong>
                    </span>
                    <sl-icon-button
                        src=${xIcon}
                        label="${msg("Cancel")}"
                        @click=${this._cancelAddRelation}
                    ></sl-icon-button>
                </div>
            ` : ''}

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
        `;
    }
}