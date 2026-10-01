import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { customElement, property } from "lit/decorators.js";
import '@shoelace-style/shoelace/dist/themes/light.css';
import { ClassObjectContainer } from "./components/class-object-diagram/components/class-object-container/class-object-container";
import { ClassSettings } from "./components/class-object-diagram/models/class-settings-model";
import { SequenceDiagramContainer } from "./components/sequence-diagram/components/container/sequence-diagram-container";
import { SequenceSettings } from "./components/sequence-diagram/models/sequence-settings-model";
import { GlobalSettings } from "./components/global-settings/global-settings-model";
import { GlobalSettingsMenu } from "./components/global-settings/global-settings-menu/global-settings-menu";
import { SequenceModel } from "./components/sequence-diagram/models/sequence-model";
import { DiagramTabs, visibleDiagramTypes } from "./components/diagram-tabs/diagram-tabs";
import styles from "./webwriter-uml-diagram.styles";
import { localized } from "@lit/localize";

/**
 * Main Widget for Object-Oriented Modelling
 * * **Responsibility:**
 * Top Level Manager for the application
 * Instantiates different diagram containers
 * Manages Visibility of the current diagram type
 * Holds and distributes settings
 */
@localized()
@customElement("webwriter-uml-diagram")
export class WebwriterUmlDiagram extends LitElementWw {

    /** Register used Elements */
    static get scopedElements() {
        return {
            "class-object-container": ClassObjectContainer,
            "sequence-diagram-container": SequenceDiagramContainer,
            "global-settings-menu": GlobalSettingsMenu,
            "diagram-tabs": DiagramTabs
        };
    }

    /** Constructor for fullscreen */
    constructor() {
        super();
        this.addEventListener("fullscreenchange", () => this.requestUpdate());
    }
  
    /** Set Styles for this Element */
    static styles = [styles];

    /** Create References & States */

    /** property for the settings for the class diagram */
    @property({
        attribute: 'class-settings',
        reflect: true,
        converter: {
            fromAttribute: (value: string) => {
                if (!value) return ClassSettings.getInitialClassDiagramSettings();
                try { return Object.assign(new ClassSettings(), JSON.parse(value)); }
                catch { return ClassSettings.getInitialClassDiagramSettings(); }
            },
            toAttribute: (value: ClassSettings) => JSON.stringify(value)
        }
    })
    accessor classSettings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** property for the settings for the object diagram */
    @property({
        attribute: 'object-settings',
        reflect: true,
        converter: {
            fromAttribute: (value: string) => {
                if (!value) return ClassSettings.getInitialObjectDiagramSettings();
                try { return Object.assign(new ClassSettings(), JSON.parse(value)); }
                catch { return ClassSettings.getInitialObjectDiagramSettings(); }
            },
            toAttribute: (value: ClassSettings) => JSON.stringify(value)
        }
    })
    accessor objectSettings: ClassSettings = ClassSettings.getInitialObjectDiagramSettings();

    /** property for the settings for the sequence diagram */
    @property({
        attribute: 'sequence-settings',
        reflect: true,
        converter: {
            fromAttribute: (value: string) => {
                if (!value) return SequenceSettings.getInitialSequenceSettings();
                try { 
                    const initial = SequenceSettings.getInitialSequenceSettings();
                    return Object.assign(initial, JSON.parse(value));
                }
                catch { return SequenceSettings.getInitialSequenceSettings(); }
            },
            toAttribute: (value: SequenceSettings) => JSON.stringify(value)
        }
    })
    accessor sequenceSettings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

    /** property for the global settings */
    @property({
        attribute: 'global-settings',
        reflect: true,
        converter: {
            fromAttribute: (value: string) => {
                if (!value) return GlobalSettings.getInitialGlobalSettings();
                try { return Object.assign(new GlobalSettings(), JSON.parse(value)); }
                catch { return GlobalSettings.getInitialGlobalSettings(); }
            },
            toAttribute: (value: GlobalSettings) => JSON.stringify(value)
        }
    })
    accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** property to store the current diagram type */
    @property({ attribute: 'diagram-type', reflect: true }) accessor diagramType: string = "class-diagram";

    /** property to the current sequence diagram */
    @property({
        attribute: 'sequence-model-data',
        reflect: true,
        converter: {
            fromAttribute: (value: string) => {
                if (!value) return SequenceModel.getInitialModel();
                try { return Object.assign(new SequenceModel(), JSON.parse(value)); }
                catch { return SequenceModel.getInitialModel(); }
            },
            toAttribute: (value: SequenceModel) => JSON.stringify(value)
        }
    })
    accessor sequenceModelData: SequenceModel = SequenceModel.getInitialModel();

    /** Property to store the state of the class diagram */
    @property({ attribute: 'class-diagram-data', reflect: true }) accessor classDiagramData: string = '';

    /** Property to store the state of the object diagram */
    @property({ attribute: 'object-diagram-data', reflect: true }) accessor objectDiagramData: string = '';

    /**
     * Checkpoints learners can return to: the diagrams as saved by the author, i.e. as loaded.
     * Taken from the attributes on the first update, so they are not affected by later (learner) changes.
     */
    private _classDiagramCheckpoint = '';
    private _objectDiagramCheckpoint = '';
    private _sequenceDiagramCheckpoint = '';

    /**
     * Diagram changes are written to the attributes only after editing has paused for this long (ms).
     * WebWriter records every attribute change as its own undo step, and a single user action
     * (e.g. creating a relation) can emit several intermediate states.
     */
    private static readonly SAVE_DELAY = 300;

    /** Pending diagram changes by diagram type, applied together after SAVE_DELAY */
    private _pendingSaves = new Map<string, () => void>();
    private _saveTimeout?: ReturnType<typeof setTimeout>;

    protected willUpdate() {
        if (!this.hasUpdated) {
            this._classDiagramCheckpoint = this.getAttribute('class-diagram-data') ?? '';
            this._objectDiagramCheckpoint = this.getAttribute('object-diagram-data') ?? '';
            this._sequenceDiagramCheckpoint = this.getAttribute('sequence-model-data') ?? '';
        }
    }

    disconnectedCallback() {
        this._flushSaves();
        super.disconnectedCallback();
    }

    /** Schedules a diagram change to be written once editing has paused, replacing an earlier pending one */
    private _scheduleSave(diagramType: string, save: () => void) {
        this._pendingSaves.set(diagramType, save);
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => this._flushSaves(), WebwriterUmlDiagram.SAVE_DELAY);
    }

    /** Writes all pending diagram changes */
    private _flushSaves() {
        clearTimeout(this._saveTimeout);
        this._pendingSaves.forEach(save => save());
        this._pendingSaves.clear();
    }

    /** getter for state of fullscreen */
    get isFullscreen() {
        return this.ownerDocument.fullscreenElement === this;
    }

    // --------------------------------------------------------------------------------------------------------
    // Handlers for changes in the diagrams
    // --------------------------------------------------------------------------------------------------------

    /** Handles fullscreen toggle requests from the editors */
    private _handleToggleFullscreen() {
        if (this.isFullscreen) {
            this.ownerDocument.exitFullscreen();
        } else {
            this.requestFullscreen();
        }
        setTimeout(() => this.requestUpdate(), 100);
    }

    /** Handles model changes from the sequence diagram container */
    private _handleSequenceModelChanged(e: CustomEvent) {
        const model = e.detail.model;
        this._scheduleSave('sequence-diagram', () => this.sequenceModelData = model);
    }

    /** Handles diagram data changes from the class/object diagram editor */
    private _handleDiagramDataChanged(e: CustomEvent) {
        const { diagramType, data } = e.detail;
        if (diagramType === 'class-diagram') {
            this._scheduleSave(diagramType, () => this.classDiagramData = data);
        } else if (diagramType === 'object-diagram') {
            this._scheduleSave(diagramType, () => this.objectDiagramData = data);
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // Handlers for settings
    // --------------------------------------------------------------------------------------------------------

    /** Handles if the global settings menu sends any changes */
    private _handleSettingsUpdate(e: CustomEvent) {
        const { diagramType, updatedSettings } = e.detail;

        switch (diagramType) {
            case 'global-settings':
                this.globalSettings = updatedSettings;
                // If the current diagram type was disabled, switch to the first enabled one
                const currentlyEnabled = 
                    (this.diagramType === 'class-diagram' && updatedSettings.classDiagramEnabled) ||
                    (this.diagramType === 'object-diagram' && updatedSettings.objectDiagramEnabled) ||
                    (this.diagramType === 'sequence-diagram' && updatedSettings.sequenceDiagramEnabled);
                
                if (!currentlyEnabled) {
                    if (updatedSettings.classDiagramEnabled) {
                        this.diagramType = 'class-diagram';
                    } else if (updatedSettings.objectDiagramEnabled) {
                        this.diagramType = 'object-diagram';
                    } else if (updatedSettings.sequenceDiagramEnabled) {
                        this.diagramType = 'sequence-diagram';
                    }
                }
                break;
            case 'class-diagram':
                this.classSettings = updatedSettings;
                break;
            case 'object-diagram':
                this.objectSettings = updatedSettings;
                break;
            case 'sequence-diagram':
                this.sequenceSettings = updatedSettings;
                break;
            default:
                // Do nothing
        }
    }

    /** Handler to change the active diagram type and switch views */
    private _handleChangeDiagram(newType: string) {
        if (this.diagramType !== newType) {
            this.diagramType = newType;
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // Render Method
    // --------------------------------------------------------------------------------------------------------

    /** Defines the HTML structure of the widget. */
    render() {
        const hideClassDiagram = this.diagramType === 'class-diagram' ? '' : 'display: none;';
        const hideObjectDiagram = this.diagramType === 'object-diagram' ? '' : 'display: none;';
        const hideSequenceDiagram = this.diagramType === 'sequence-diagram' ? '' : 'display: none;';

        // The first visible tab sits on the frame's top left corner, so that corner is only rounded when another tab is active
        const firstTabType = visibleDiagramTypes(this.globalSettings, this.diagramType)[0];

        return html`
            <div class="root ${this.isFullscreen ? 'fullscreen' : ''}">
                <diagram-tabs
                    .active=${this.diagramType}
                    .globalSettings=${this.globalSettings}
                    ?fullscreen=${this.isFullscreen}
                    @select-diagram=${(e: CustomEvent) => this._handleChangeDiagram(e.detail.type)}
                ></diagram-tabs>

                <div class="frame ${this.diagramType === firstTabType ? 'first-tab-active' : ''}">
                    <div 
                        class="diagram-wrapper" 
                        style="${hideSequenceDiagram}"
                    >
                        <sequence-diagram-container
                            .settings=${this.sequenceSettings}
                            .globalSettings=${this.globalSettings}
                            .model=${this.sequenceModelData}
                            .checkpoint=${this._sequenceDiagramCheckpoint}
                            .contentEditable=${this.contentEditable}
                            @sequence-model-changed=${this._handleSequenceModelChanged}
                            @toggle-fullscreen=${this._handleToggleFullscreen}
                            .isFullscreen=${this.isFullscreen}
                        ></sequence-diagram-container>
                    </div>

                    <div 
                        class="diagram-wrapper" 
                        style="${hideClassDiagram}"
                    >
                        <class-object-container 
                            diagramType="class-diagram"
                            .settings=${this.classSettings}
                            .globalSettings=${this.globalSettings}
                            .savedDiagramData=${this.classDiagramData}
                            .checkpoint=${this._classDiagramCheckpoint}
                            .contentEditable=${this.contentEditable}
                            @diagram-data-changed=${this._handleDiagramDataChanged}
                            @toggle-fullscreen=${this._handleToggleFullscreen}
                            .isFullscreen=${this.isFullscreen}
                        ></class-object-container>
                    </div>

                    <div 
                        class="diagram-wrapper" 
                        style="${hideObjectDiagram}"
                    >
                        <class-object-container 
                            diagramType="object-diagram"
                            .settings=${this.objectSettings}
                            .globalSettings=${this.globalSettings}
                            .savedDiagramData=${this.objectDiagramData}
                            .checkpoint=${this._objectDiagramCheckpoint}
                            .contentEditable=${this.contentEditable}
                            @diagram-data-changed=${this._handleDiagramDataChanged}
                            @toggle-fullscreen=${this._handleToggleFullscreen}
                            .isFullscreen=${this.isFullscreen}
                        ></class-object-container>
                    </div>
                </div>
            </div>

            <global-settings-menu
                part="options"
                .globalSettings=${this.globalSettings}
                .classSettings=${this.classSettings}
                .objectSettings=${this.objectSettings}
                .sequenceSettings=${this.sequenceSettings}
                @settings-changed=${this._handleSettingsUpdate}
            ></global-settings-menu>
        `;
    }
}