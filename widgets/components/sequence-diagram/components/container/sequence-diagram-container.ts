import { html, PropertyValues } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { state, property, query } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SequenceToolbar } from "../toolbar/sequence-diagram-toolbar";
import { SequenceEditor } from "../editor/sequence-diagram-editor";
import { SequenceModel } from "../../models/sequence-model"; 
import { SequenceSettings } from "../../models/sequence-settings-model";
import styles from "./sequence-diagram-container.styles";
import { GlobalSettings } from "../../../global-settings/global-settings-model";
import { cancelOnOutsideInteraction } from "../../../shared/interaction";
import { resetDiagramConfirmOptions } from "../../../shared/confirm-dialog";

/** Different types of Interaction Modes the editor can be in */
export type InteractionMode = 'idle' | 'add-message-source' | 'add-message-target' | 'add-activation' | 'creating-fragment-start' | 'creating-fragment-end';

/** Controller for the sequence diagram whitch connects the toolbar and the editor */
@localized()
export class SequenceDiagramContainer extends LitElementWw {

    /** register all used elements */
    static get scopedElements() {
        return {
            "sequence-toolbar": SequenceToolbar,
            "sequence-editor": SequenceEditor
        };
    }

    /** The state of the diagram (begin with the initial model) */
    @property({ attribute: false }) accessor model: SequenceModel = SequenceModel.getInitialModel();
    
    /** Store in which interaction mode the model is right now (begin with idle) */
    @state() accessor interactionMode: InteractionMode = 'idle';

    @query("sequence-editor") private accessor _editor!: SequenceEditor;

    /** Store the source id of a message while creating a new one */
    @state() accessor messageSourceId: string | null = null;

    /** Store the fragment type while creating a new one */
    @state() private pendingFragmentType: 'opt' | 'alt' | 'loop' | null = null;

    /** Store the fragment source while creating a new one */
    @state() private fragmentSourceId: string | null = null;

    /** Store the y-coordinate of the fragment source click */
    @state() private fragmentStartY: number = 0;

    /** Store the message type while creating a new one */
    @state() accessor pendingMessageType: 'sync' | 'async' | 'reply' | 'create-new' | 'create-existing' | 'destroy' |'found' | 'lost' = 'sync';

    /** Property to receive the settings from the main widget */
    @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

    /** Property to store the state of the fullscreen mode */
    @property({ attribute: false }) accessor isFullscreen: boolean = false;

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** property for the state of the checkpoint learners can return to */
    @property({ attribute: false }) accessor checkpoint: any = null;

    /** styles are defined in the container.styles */
    static styles = [styles];

    // --------------------------------------------------------------------------------------------------------
    // General Management
    // --------------------------------------------------------------------------------------------------------

    /** Updates the model and notifies the parent widget to persist the change */
    private _updateModel(newModel: SequenceModel) {
        this.model = newModel;
        this.dispatchEvent(new CustomEvent('sequence-model-changed', {
            detail: { model: newModel },
            bubbles: true,
            composed: true
        }));
    }

    /** clear the diagram and cancel all interaction mode */
    private async _handleClearDiagram() {
        const toCheckpoint = !!(this.globalSettings.useCheckpoint && this.checkpoint && this.contentEditable === undefined);
        if (!await this._editor.confirm(resetDiagramConfirmOptions(toCheckpoint))) return;
        if (toCheckpoint) {
            const checkpointModel = typeof this.checkpoint === 'string' 
                ? Object.assign(new SequenceModel(), JSON.parse(this.checkpoint))
                : this.checkpoint;
            this._updateModel(checkpointModel);
        } else {
            this._updateModel(SequenceModel.getEmptyModel());
        }
        this._cancelInteractionMode();
    }
    
    /** Aborting it removes the listeners that cancel the current interaction mode */
    private _cancelListeners?: AbortController;

    /**
     * While an interaction mode is active, cancel it on Escape, on pointer presses or focus outside of the diagram
     * and when the window loses focus. Presses on the toolbar cancel it as well (see render).
     */
    protected updated(changed: PropertyValues) {
        if (changed.has('interactionMode')) {
            this._cancelListeners?.abort();
            this._cancelListeners = this.interactionMode !== 'idle'
                ? cancelOnOutsideInteraction(this, () => this._cancelInteractionMode())
                : undefined;
        }
    }

    disconnectedCallback() {
        this._cancelListeners?.abort();
        this._cancelInteractionMode();
        super.disconnectedCallback();
    }

    /** Cancel the current interaction mode (like message mode, ...) */
    private _cancelInteractionMode() {
        this.interactionMode = 'idle';
        this.messageSourceId = null;
        this.pendingFragmentType = null;
        this.fragmentSourceId = null;
    }

    // --------------------------------------------------------------------------------------------------------
    // Lifeline/Object Management
    // --------------------------------------------------------------------------------------------------------

    /** Create and add a new object/liveline to the diagram */
    private _handleAddLifeline() {
        // test if constraint is reached
        if(this.model.lifelines.length >= this.settings.maxNumberOfLifelines) {
            return;
        }

        // Create a new empty object
        const newLifeline = {
            id: `ll-${Date.now()}`,
            name: "object",
            className: "",
            stereotype: "",
            icon: "none",
            y: 40,
            length: 400,
            activations: []
        };

        // Change the state of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = [...this.model.lifelines, newLifeline];
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = [...(this.model.fragments || [])];
        this._updateModel(updatedModel);
    }

    /** handle changes of the lifeline data from within the drawer */
    private _handleUpdateLifeline(e: CustomEvent) {
        const { id, ...changes } = e.detail;

        // create the updated lifeline data
        const updatedLifelines = this.model.lifelines.map(ll => {
            if (ll.id === id) {
                return { ...ll, ...changes };
            }
            return ll;
        });

        // update the model of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = updatedLifelines;
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = [...(this.model.fragments || [])];

        this._updateModel(updatedModel);
    }

    /** Change the order of the objects/lifelines */
    private _handleReorderLifeline(e: CustomEvent) {
        const { id, shift } = e.detail;

        // get the index of the selected object
        const currentIndex = this.model.lifelines.findIndex(ll => ll.id === id);
        if (currentIndex === -1) return;
        // calculate the new position 
        let newIndex = currentIndex + shift;
        newIndex = Math.max(0, Math.min(newIndex, this.model.lifelines.length - 1));
        // change the object to the new position
        if (currentIndex === newIndex) return;
        const updatedLifelines = [...this.model.lifelines];
        const [movedItem] = updatedLifelines.splice(currentIndex, 1);
        updatedLifelines.splice(newIndex, 0, movedItem);

        // After reordering, ensure startLifelineId always refers to the left (lower index) lifeline
        const updatedFragments = (this.model.fragments || []).map(frag => {
            const startIdx = updatedLifelines.findIndex(ll => ll.id === frag.startLifelineId);
            const endIdx = updatedLifelines.findIndex(ll => ll.id === frag.endLifelineId);
            if (startIdx > endIdx) {
                return { ...frag, startLifelineId: frag.endLifelineId, endLifelineId: frag.startLifelineId };
            }
            return frag;
        });

        // update the state of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = updatedLifelines;
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = updatedFragments;

        this._updateModel(updatedModel);
    }

    /** Handle the delete of a lifeline */
    private _handleDeleteLifeline(e: CustomEvent) {
        const { id } = e.detail;
        // update the model of the diagram (delete the lifeline and associated messages from it)
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = this.model.lifelines.filter(ll => ll.id !== id);
        updatedModel.messages = this.model.messages.filter(msg => 
            msg.sourceId !== id && msg.targetId !== id
        );
        updatedModel.fragments = [...(this.model.fragments || [])];

        this._updateModel(updatedModel);
    }

    // --------------------------------------------------------------------------------------------------------
    // Activation Bar Management
    // --------------------------------------------------------------------------------------------------------

    /** Enter the interaction mode to place a new activation bar */
    private _handleAddActivationMode() {
        this.interactionMode = 'add-activation';
    }

    /** Handle the selection of a lifeline for the new activation bar */
    private _handleAddActivationAt(e: CustomEvent) {
        // Check if max number of activations is already placed (the toolbar is disabled then)
        const totalActivations = this.model.lifelines.reduce((sum, ll) => 
            sum + (ll.activations?.length || 0), 0
        );
        
        if (totalActivations >= this.settings.maxNumberOfActivations) {
            return;
        }

        const { id, y, length } = e.detail;
        
        // assign default and min values for the size of the activation bar
        const DEFAULT_LENGTH = 60;
        const MIN_LENGTH = 15; 

        const lifeline = this.model.lifelines.find(l => l.id === id);
        if (!lifeline) return;

        // sort the activations by their y coordinate
        const sortedActs = [...(lifeline.activations || [])].sort((a, b) => a.y - b.y);

        // Use calculated corrected length if possible or default otherwise
        let calculatedLength = length !== undefined ? length : DEFAULT_LENGTH;

        // calculate if it's a nested activation bar to set the end of the outer one as upper bound for the length of the new one
        const parentAct = sortedActs.find(act => y >= act.y && y < act.y + act.length);
        if (parentAct) {
            const spaceLeft = (parentAct.y + parentAct.length) - y;
            calculatedLength = Math.min(calculatedLength, spaceLeft);
        }

        // calculate the distance to the next activation bar (as upper bound for the length of the new one
        const nextAct = sortedActs.find(act => act.y > y);
        if (nextAct) {
            const spaceToNext = nextAct.y - y;
            calculatedLength = Math.min(calculatedLength, spaceToNext);
        }

        // if the activation would be to small cancel the placement
        if (calculatedLength < MIN_LENGTH) {
            this._cancelInteractionMode();
            return; 
        }

        // create the new activation bar
        const newActivation = {
            id: `act-${Date.now()}`,
            y: y,
            length: calculatedLength
        };

        // update the model of the diagram
        const updatedLifelines = this.model.lifelines.map(ll => {
            if (ll.id === id) {
                return {
                    ...ll,
                    activations: [...(ll.activations || []), newActivation]
                };
            }
            return ll;
        });
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = updatedLifelines;
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = [...(this.model.fragments || [])];

        this._updateModel(updatedModel);
        
        // end the interaction mode
        this._cancelInteractionMode();
    }

    /** Update the length or position of an activation bar */
    private _handleUpdateActivation(e: CustomEvent) {
        const { lifelineId, activationId, y, length } = e.detail;
        // update the model of the diagram
        const updatedLifelines = this.model.lifelines.map(ll => {
            if (ll.id === lifelineId) {
                const updatedActs = (ll.activations || []).map(act => {
                    if (act.id === activationId) {
                        return {
                            ...act,
                            ...(y !== undefined && { y }),
                            ...(length !== undefined && { length })
                        };
                    }
                    return act;
                });
                return { ...ll, activations: updatedActs };
            }
            return ll;
        });
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = updatedLifelines;
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = [...(this.model.fragments || [])];

        this._updateModel(updatedModel);
    }

    /** Handle the deletion of an activation bar from within the drawer */
    private _handleDeleteActivation(e: CustomEvent) {
        const { lifelineId, activationId } = e.detail;
        // update the model of the diagram
        const updatedLifelines = this.model.lifelines.map(ll => {
            if (ll.id === lifelineId) {
                return {
                    ...ll,
                    activations: (ll.activations || []).filter(act => act.id !== activationId)
                };
            }
            return ll;
        });
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = updatedLifelines;
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = [...(this.model.fragments || [])];

        this._updateModel(updatedModel);
    }

    // --------------------------------------------------------------------------------------------------------
    // Message Management
    // --------------------------------------------------------------------------------------------------------

    /** Enter the message mode to select the source lifeline of a message */
    private _startMessageMode(e: CustomEvent) {
        // Check for constraints
        if(this.model.messages.length >= this.settings.maxNumberOfMessages) {
            return;
        }
        // Found Messages do not need a source lifeline
        if (e.detail.messageType == 'found') {
            this.interactionMode = 'add-message-target';
        } else {
            this.interactionMode = 'add-message-source';
        }
        // Temporary storage of some message data
        this.messageSourceId = 'external';
        this.pendingMessageType = e.detail.messageType; 
    }

    /** Handle the selection of a source node for a new message */
    private _handleSourceSelected(e: CustomEvent) {
        const { id: sourceId, y } = e.detail;

        if (this.pendingMessageType === 'create-new') {
            // If it's a create message for a new object:
            // create the new object
            const newLifelineId = `ll-${Date.now()}`;
            const newLifeline = {
                id: newLifelineId,
                name: "object",
                className: "",
                stereotype: "",
                icon: "none",
                y: y,
                length: 400,
                activations: []
            };
            // create the message (set selected node as source and the new one as target)
            const newMessage = {
                id: `msg-${Date.now()}`,
                name: "<<create>>",
                assignment: "",
                sourceId: sourceId,
                targetId: newLifelineId,
                y: y,
                type: 'create' as const
            };
            // update the model
            const updatedModel = new SequenceModel();
            updatedModel.lifelines = [...this.model.lifelines, newLifeline];
            updatedModel.messages = [...this.model.messages, newMessage];
            updatedModel.fragments = [...(this.model.fragments || [])];
            this._updateModel(updatedModel);
            // end the interaction mode
            this._cancelInteractionMode();
        } else if (this.pendingMessageType === 'lost') {
            // If its a lost message the message do not need a target, so create it directly
            const newMessage = {
                id: `msg-${Date.now()}`,
                name: "lostMessage()",
                assignment: "",
                sourceId: sourceId,
                targetId: "external",
                y: y,
                type: 'lost' as const 
            };
            // update the mode
            const updatedModel = new SequenceModel();
            updatedModel.lifelines = [...this.model.lifelines]; 
            updatedModel.messages = [...this.model.messages, newMessage];
            updatedModel.fragments = [...(this.model.fragments || [])];
            this._updateModel(updatedModel);
            // end the interaction mode
            this._cancelInteractionMode();
        } else {
            // for all other message types wait for the target to be selected
            this.messageSourceId = sourceId;
            this.interactionMode = 'add-message-target';
        }
    }

    /** Handle the selection of the target node for a new message */
    private _handleTargetSelected(e: CustomEvent) {
        const { id: targetId, y } = e.detail;

        // If its a destroy message check if the target already gets destroyed
        if (this.pendingMessageType === 'destroy') {
            const isAlreadyDestroyed = this.model.messages.some(
                m => m.type === 'destroy' && m.targetId === targetId
            );
            if (isAlreadyDestroyed) {
                this._editor.showNotice(msg("This object is already destroyed by another message. A lifeline can only be destroyed once."));
                this._cancelInteractionMode();
                return; 
            }
        }
        
        // assign a name for the message depending on the type
        let msgName = "newMessage()";
        if (this.pendingMessageType === 'reply') msgName = "returnData";
        if (this.pendingMessageType === 'create-existing') msgName = "<<create>>";

        // create the new message
        const newMessage = {
            id: `msg-${Date.now()}`,
            name: msgName,
            assignment: "",
            sourceId: this.messageSourceId!,
            targetId: targetId,
            y: y,
            // map type to model format
            type: this.pendingMessageType === 'create-existing' ? 'create' : this.pendingMessageType as any
        };

        // update the model of the diagram
        const updatedModel = new SequenceModel();
        // update the target coordinate if its a crate-existing message
        if (this.pendingMessageType === 'create-existing') {
            updatedModel.lifelines = this.model.lifelines.map(ll => 
                ll.id === targetId ? { ...ll, y: y } : ll
            );
        } else {
            updatedModel.lifelines = [...this.model.lifelines];
        }
        updatedModel.messages = [...this.model.messages, newMessage];
        updatedModel.fragments = [...(this.model.fragments || [])];
        this._updateModel(updatedModel);

        this._cancelInteractionMode();
    }

    /** handle the update of the data of a message from within the drawer */
    private _handleUpdateMessage(e: CustomEvent) {
        const { id, ...changes } = e.detail;

        // update the data of the selected message
        const updatedMessages = this.model.messages.map(msg => {
            if (msg.id === id) {
                return { ...msg, ...changes };
            }
            return msg;
        });
        // update the model of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = [...this.model.lifelines];
        updatedModel.messages = updatedMessages;
        updatedModel.fragments = [...(this.model.fragments || [])];
        
        this._updateModel(updatedModel);
    }

    /** handle the delete of a selected message */
    private _handleDeleteMessage(e: CustomEvent) {
        const { id } = e.detail;
        // update the model of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = [...this.model.lifelines];
        updatedModel.messages = this.model.messages.filter(msg => msg.id !== id);
        updatedModel.fragments = [...(this.model.fragments || [])];
        this._updateModel(updatedModel);
    }

    // --------------------------------------------------------------------------------------------------------
    // Fragment Management
    // --------------------------------------------------------------------------------------------------------

    /** Start the selection process of a source lifeline for the new fragment */
    private _startFragmentMode(e: CustomEvent) {
        // check for constraints
        if(this.model.fragments.length >= this.settings.maxNumberOfFragments) {
            return;
        }
        // enter the creating-fragment-start interaction mode and store the type of the new fragment
        const { type } = e.detail;
        this.interactionMode = 'creating-fragment-start';
        this.pendingFragmentType = type;
    }

    /** Handle the selection of the source lifeline of a new fragment */
    private _handleFragmentSourceSelected(e: CustomEvent) {
        const { id, y } = e.detail;
        // store the id and the clamped y of the selected node
        this.fragmentSourceId = id;
        this.fragmentStartY = y;
        
        // enter creating-fragment-end interaction mode to enter the target lifeline
        this.interactionMode = 'creating-fragment-end';
    }

    /** Handle the selection of the target lifeline of a new fragment */
    private _handleFragmentTargetSelected(e: CustomEvent) {
        const { id: targetId } = e.detail;

        // create two reagions for alt (condition and else) and only one for loop and opt (only condition)
        const operands = [];
        if (this.pendingFragmentType === 'alt') {
            operands.push({ id: `op-${Date.now()}-1`, guard: "[condition]", height: 80 });
            operands.push({ id: `op-${Date.now()}-2`, guard: "[else]", height: 80 });
        } else {
            operands.push({ id: `op-${Date.now()}-1`, guard: "[condition]", height: 100 });
        }

        // create the new fragment
        const sourceIdx = this.model.lifelines.findIndex(ll => ll.id === this.fragmentSourceId);
        const targetIdx = this.model.lifelines.findIndex(ll => ll.id === targetId);
        const leftId = sourceIdx <= targetIdx ? this.fragmentSourceId : targetId;
        const rightId = sourceIdx <= targetIdx ? targetId : this.fragmentSourceId;

        const newFragment = {
            id: `frag-${Date.now()}`,
            type: this.pendingFragmentType,
            startLifelineId: leftId,
            endLifelineId: rightId,
            y: this.fragmentStartY, 
            operands: operands
        };

        // update the model of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = [...this.model.lifelines];
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = [...(this.model.fragments || []), newFragment];

        this._updateModel(updatedModel);

        // end the interaction mode
        this._cancelInteractionMode();
    }

    /** handle updates for the fragments-data from the drawer */
    private _handleUpdateFragment(e: CustomEvent) {
        const { id, ...changes } = e.detail;
        // Change the data of the fragment
        const updatedFragments = (this.model.fragments || []).map(frag => {
            if (frag.id === id) {
                return { ...frag, ...changes };
            }
            return frag;
        });
        // update the model
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = [...this.model.lifelines];
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = updatedFragments;
        
        this._updateModel(updatedModel);
    }

    /** handle the deletion of a fragment from within the drawer menu */
    private _handleDeleteFragment(e: CustomEvent) {
        const { id } = e.detail;
        // update the model of the diagram
        const updatedModel = new SequenceModel();
        updatedModel.lifelines = [...this.model.lifelines];
        updatedModel.messages = [...this.model.messages];
        updatedModel.fragments = (this.model.fragments || []).filter(f => f.id !== id);
        
        this._updateModel(updatedModel);
    }

    // --------------------------------------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------------------------------------

    render() {
        return html`
            <sequence-toolbar 
                @pointerdown=${this._cancelInteractionMode}
                .model=${this.model}
                .settings=${this.settings}
                @add-lifeline=${this._handleAddLifeline}
                @add-activation=${this._handleAddActivationMode}
                @add-message-mode=${this._startMessageMode}
                @add-fragment-mode=${this._startFragmentMode}
                @clear-diagram=${this._handleClearDiagram}
            ></sequence-toolbar>
            
            <sequence-editor 
                class="sequence-editor-wrapper"

                .model=${this.model}
                .interactionMode=${this.interactionMode}
                .messageSourceId=${this.messageSourceId}
                .fragmentSourceId=${this.fragmentSourceId}
                .settings=${this.settings}
                .globalSettings=${this.globalSettings}
                .pendingMessageType=${this.pendingMessageType}
                .isFullscreen=${this.isFullscreen}

                @cancel-interaction=${this._cancelInteractionMode}
                @select-source=${this._handleSourceSelected}
                @select-target=${this._handleTargetSelected}

                @add-activation-at=${this._handleAddActivationAt}
                @update-activation=${this._handleUpdateActivation}
                @delete-activation=${this._handleDeleteActivation}

                @select-fragment-source=${this._handleFragmentSourceSelected}
                @select-fragment-target=${this._handleFragmentTargetSelected}
                @update-fragment=${this._handleUpdateFragment}
                @delete-fragment=${this._handleDeleteFragment}
                
                @update-lifeline=${this._handleUpdateLifeline}
                @reorder-lifeline=${this._handleReorderLifeline}
                @delete-lifeline=${this._handleDeleteLifeline}

                @update-message=${this._handleUpdateMessage}
                @delete-message=${this._handleDeleteMessage}
            ></sequence-editor>
        `;
    }
}