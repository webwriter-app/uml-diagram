import { html } from "lit";
import { LitElementWw, type OptionDeclaration } from "@webwriter/lit";
import { customElement, property, state } from "lit/decorators.js";
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
import { localized, msg } from "@lit/localize";
import LOCALIZE from "../localization/generated";
import { readData, writeData } from "./data-state";

/**
 * Interactive editor for UML class, object and sequence diagrams.
 * Authors configure the available diagram types, elements, limits and validation rules and can provide a
 * starting diagram that learners can reset to. Learners model their solution directly in the widget.
 * @slot data - Direct application/json block stores diagram settings and authored models.
 */
@localized()
@customElement("webwriter-uml-diagram")
export class WebwriterUmlDiagram extends LitElementWw {
    static options: Record<string, OptionDeclaration> = {
        diagramType: {
            type: "select",
            label: { _: "Diagram to show", de: "Anzuzeigendes Diagramm" },
            options: [
                { value: "class-diagram", label: { _: "Class diagram", de: "Klassendiagramm" } },
                { value: "object-diagram", label: { _: "Object diagram", de: "Objektdiagramm" } },
                { value: "sequence-diagram", label: { _: "Sequence diagram", de: "Sequenzdiagramm" } },
            ],
        },
    };
    static actions = {
        openSettings: { label: { _: "Configure diagrams", de: "Diagramme konfigurieren" }, icon: "Settings", intent: "default" },
    };
    readonly options = WebwriterUmlDiagram.options;
    readonly actions = WebwriterUmlDiagram.actions;

    @state() private accessor settingsOpen = false;

    openSettings() {
        this.settingsOpen = true;
    }

    /** @internal Localization config; WebWriter uses it to set the locale of the widget */
    public localize = LOCALIZE;

    /** @internal Register used Elements */
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
  
    /** @internal Set Styles for this Element */
    static styles = [styles];

    /** Create References & States */

    /** Class diagram settings as JSON: available class and relation types, limits and validation rules */
    @property({ attribute: false })
    accessor classSettings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Object diagram settings as JSON: available elements, displayed details, limits and validation rules */
    @property({ attribute: false })
    accessor objectSettings: ClassSettings = ClassSettings.getInitialObjectDiagramSettings();

    /** Sequence diagram settings as JSON: available messages, fragments and activations, limits and validation rules */
    @property({ attribute: false })
    accessor sequenceSettings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

    /** Global settings as JSON: enabled diagram types, checkpoint reset and validation mode */
    @property({ attribute: false })
    accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** Currently shown diagram: `class-diagram`, `object-diagram` or `sequence-diagram` */
    @property({ attribute: 'diagram-type', reflect: true }) accessor diagramType: string = "class-diagram";

    /** Sequence diagram content as JSON (lifelines, messages and fragments) */
    @property({ attribute: false })
    accessor sequenceModelData: SequenceModel = SequenceModel.getInitialModel();

    /** Class diagram content as JSON */
    @property({ attribute: false }) accessor classDiagramData: string = '';

    /** Object diagram content as JSON */
    @property({ attribute: false }) accessor objectDiagramData: string = '';

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
    private _dataObserver = new MutationObserver(() => this._restoreData());

    private _restoreData() {
        const data = readData(this);
        if (data.classSettings) this.classSettings = Object.assign(ClassSettings.getInitialClassDiagramSettings(), data.classSettings);
        if (data.objectSettings) this.objectSettings = Object.assign(ClassSettings.getInitialObjectDiagramSettings(), data.objectSettings);
        if (data.sequenceSettings) this.sequenceSettings = Object.assign(SequenceSettings.getInitialSequenceSettings(), data.sequenceSettings);
        if (data.globalSettings) this.globalSettings = Object.assign(GlobalSettings.getInitialGlobalSettings(), data.globalSettings);
        if (data.sequenceModelData) this.sequenceModelData = Object.assign(SequenceModel.getInitialModel(), data.sequenceModelData);
        const classData = data.classDiagramData;
        if (classData !== undefined) this.classDiagramData = typeof classData === 'string' ? classData : JSON.stringify(classData);
        const objectData = data.objectDiagramData;
        if (objectData !== undefined) this.objectDiagramData = typeof objectData === 'string' ? objectData : JSON.stringify(objectData);
    }

    private _writeData() {
        const parse = (value: string) => {
            try { return JSON.parse(value); } catch { return value; }
        };
        writeData(this, {
            classSettings: this.classSettings,
            objectSettings: this.objectSettings,
            sequenceSettings: this.sequenceSettings,
            globalSettings: this.globalSettings,
            sequenceModelData: this.sequenceModelData,
            classDiagramData: parse(this.classDiagramData),
            objectDiagramData: parse(this.objectDiagramData),
        });
    }

    protected willUpdate() {
        if (!this.hasUpdated) {
            this._classDiagramCheckpoint = this.classDiagramData;
            this._objectDiagramCheckpoint = this.objectDiagramData;
            this._sequenceDiagramCheckpoint = JSON.stringify(this.sequenceModelData);
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this._restoreData();
        this._dataObserver.observe(this, { childList: true, subtree: true });
        this.ownerDocument.addEventListener('mousedown', this._clearProseMirrorNodeSelection);
    }

    disconnectedCallback() {
        this._flushSaves();
        this._dataObserver.disconnect();
        this.ownerDocument.removeEventListener('mousedown', this._clearProseMirrorNodeSelection);
        super.disconnectedCallback();
    }

    protected updated(changed: Map<PropertyKey, unknown>) {
        super.updated(changed as any);
        if (this.hasUpdated && ['classSettings', 'objectSettings', 'sequenceSettings', 'globalSettings', 'sequenceModelData', 'classDiagramData', 'objectDiagramData'].some((key) => changed.has(key))) {
            this._writeData();
        }
    }

    /**
     * WebWriter selects the widget on every press, which can turn into a DOM range around it that highlights
     * all of its texts. Remove that range (the widget stays selected), but leave text fields alone.
     */
    private _clearProseMirrorNodeSelection = (e: MouseEvent) => {
        const path = e.composedPath();
        if (!path.includes(this) || (path[0] as Element).closest?.('input, textarea')) return;
        const selection = this.ownerDocument.getSelection();
        if (!selection?.rangeCount || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        const hostRange = this.ownerDocument.createRange();
        hostRange.selectNode(this);
        if (range.compareBoundaryPoints(Range.START_TO_START, hostRange) <= 0
            && range.compareBoundaryPoints(Range.END_TO_END, hostRange) >= 0) {
            selection.removeAllRanges();
        }
    };

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

    /** @internal Whether the widget is shown in fullscreen */
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

            <dialog style="max-width: min(56rem, 90vw); max-height: 85vh; overflow: auto" ?open=${this.settingsOpen} @close=${() => this.settingsOpen = false}>
                <button type="button" @click=${() => this.settingsOpen = false}>${msg("Close")}</button>
                <global-settings-menu
                    .globalSettings=${this.globalSettings}
                    .classSettings=${this.classSettings}
                    .objectSettings=${this.objectSettings}
                    .sequenceSettings=${this.sequenceSettings}
                    @settings-changed=${this._handleSettingsUpdate}
                ></global-settings-menu>
            </dialog>
        `;
    }
}
