import type { MsgFn } from "@lit/localize";
import { LitElementWw } from "@webwriter/lit";
import { localizer } from "@webwriter/lit/localize";
import { sourceLocale, targetLocales } from "../../localization/generated/locale-codes";
import { html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import '@shoelace-style/shoelace/dist/themes/light.css';
import { ClassObjectContainer } from "../components/class-object-diagram/class-object-container";
import { ClassSettings } from "../model/class-object-diagram/class-settings-model";
import { SequenceDiagramContainer } from "../components/sequence-diagram/sequence-diagram-container";
import { SequenceSettings } from "../model/sequence-diagram/sequence-settings-model";
import { GlobalSettings } from "../model/global-settings/global-settings-model";
import { GlobalSettingsMenu } from "../components/global-settings/global-settings-menu";
import { SequenceModel } from "../model/sequence-diagram/sequence-model";
import { DiagramTabs, visibleDiagramTypes } from "../components/diagram-tabs/diagram-tabs";
import styles from "../components/webwriter-uml-diagram.styles";
import { jsonData } from "@webwriter/lit/data";
import { ClassDiagram } from "../model/class-object-diagram/diagram";
import { classDiagramToPlantUml, sequenceToPlantUml } from "../model/exchange/plantuml-export";
import { parsePlantUml, type PlantUmlResult } from "../model/exchange/plantuml-import";
import { classDiagramToSvg, sequenceToSvg } from "../model/exchange/svg-export";

/**
 * Interactive editor for UML class, object and sequence diagrams.
 * Authors configure the available diagram types, elements, limits and validation rules and can provide a
 * starting diagram that learners can reset to. Learners model their solution directly in the widget.
 * @slot data - Direct application/json block stores diagram settings and authored models.
 * @part tabs - The row of diagram tabs above the frame.
 * @part frame - The bordered frame around the toolbar and the canvas.
 *
 * Theme: the text and line color of the diagrams follow `--ww-text-color`, the font follows `--ww-font-family`, and
 * the selected and hovered marks and the active tab follow `--ww-theme-accent-1`; without them the colors are unchanged.
 * Pointer, touch and keyboard: every class, relation, lifeline and message is focusable on the canvas, arrow keys move it,
 * Enter opens its drawer, Delete removes it and a long press opens the menu. The widget is laid out for widths from
 * 300 to 2100 px. On paper the toolbars and controls are left out and the shown diagram is fitted to the page and printed whole.
 *
 * Conversions: the shown diagram exports as PlantUML (`.puml`, also as a `pre`), as SVG (`image/svg+xml`, also as an
 * `img` with a data URL) and, with the settings, all diagrams as JSON (`.json`, the content of the data block, lossless).
 * PlantUML and SVG carry names, members, relation types, multiplicities and relation names (class and object diagrams),
 * or lifelines, messages, activations and fragments (sequence diagrams); they drop settings, positions (they are laid out
 * again on import), relation roles, and the other two diagrams. A PlantUML file or `pre` with classes becomes the class
 * diagram, one with `object` the object diagram and one with participants the sequence diagram; lines outside this
 * subset are skipped. The JSON file replaces the settings and all three diagrams.
 */
@customElement("webwriter-uml-diagram")
export class WebwriterUmlDiagram extends LitElementWw {
    static styles = [styles];

    /** @internal Register used Elements */
    static scopedElements = {
        "class-object-container": ClassObjectContainer,
        "sequence-diagram-container": SequenceDiagramContainer,
        "global-settings-menu": GlobalSettingsMenu,
        "diagram-tabs": DiagramTabs,
    };

    static options = {
        diagramType: {
            type: "select" as const,
            label: (widget: {msg: MsgFn}) => widget.msg("Diagram to show"),
            options: [
                { value: "class-diagram", label: (widget: {msg: MsgFn}) => widget.msg("Class diagram") },
                { value: "object-diagram", label: (widget: {msg: MsgFn}) => widget.msg("Object diagram") },
                { value: "sequence-diagram", label: (widget: {msg: MsgFn}) => widget.msg("Sequence diagram") },
            ],
        },
    };

    static convertFrom = {
        pre: "loadPlantUmlText",
        ".puml": "importPlantUml",
        ".json": "importJson",
    };

    static convertTo = {
        img: "toImage",
        pre: "toPlantUmlText",
        ".puml": "exportPlantUml",
        "image/svg+xml": "exportSvg",
        ".json": "exportJson",
    };

    static actions = {
        openSettings: { label: (widget: {msg: MsgFn}) => widget.msg("Configure diagrams"), icon: "Settings", intent: "default" as const },
    };

    localize = localizer(this, {
        sourceLocale,
        targetLocales,
        load: (locale) => import(`../../localization/generated/${locale}.ts`),
        prefer: { pt: "pt-PT" },
        drawer: true,
    });
    msg = this.localize.msg;

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

    @state() private accessor settingsOpen = false;

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
    private _skipDataWrite = false;

    /** The widget's JSON data block: settings and diagram contents, saved under the keys of the stored object */
    #data = jsonData<Record<string, any>>(this, {
        defaults: {},
        changed: (value) => this._restoreData(value),
    });

    private _restoreData(data: Record<string, any> = this.#data.get()) {
        let changed = false;
        const setIfChanged = (current: unknown, value: unknown, set: () => void) => {
            if (value !== undefined && JSON.stringify(value) !== JSON.stringify(current)) {
                set();
                changed = true;
            }
        };
        setIfChanged(this.classSettings, data.classSettings, () => this.classSettings = Object.assign(ClassSettings.getInitialClassDiagramSettings(), data.classSettings));
        setIfChanged(this.objectSettings, data.objectSettings, () => this.objectSettings = Object.assign(ClassSettings.getInitialObjectDiagramSettings(), data.objectSettings));
        setIfChanged(this.sequenceSettings, data.sequenceSettings, () => this.sequenceSettings = Object.assign(SequenceSettings.getInitialSequenceSettings(), data.sequenceSettings));
        setIfChanged(this.globalSettings, data.globalSettings, () => this.globalSettings = Object.assign(GlobalSettings.getInitialGlobalSettings(), data.globalSettings));
        setIfChanged(this.sequenceModelData, data.sequenceModelData, () => this.sequenceModelData = Object.assign(SequenceModel.getInitialModel(), data.sequenceModelData));
        const classData = data.classDiagramData;
        if (classData !== undefined) setIfChanged(this.classDiagramData, typeof classData === 'string' ? classData : JSON.stringify(classData), () => this.classDiagramData = typeof classData === 'string' ? classData : JSON.stringify(classData));
        const objectData = data.objectDiagramData;
        if (objectData !== undefined) setIfChanged(this.objectDiagramData, typeof objectData === 'string' ? objectData : JSON.stringify(objectData), () => this.objectDiagramData = typeof objectData === 'string' ? objectData : JSON.stringify(objectData));
        if (changed) this._skipDataWrite = true;
    }

    private _writeData() {
        const parse = (value: string) => {
            try { return JSON.parse(value); } catch { return value; }
        };
        this.#data.set({
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

    /** Constructor for fullscreen */
    constructor() {
        super();
        this.addEventListener("fullscreenchange", () => this.requestUpdate());
    }

    connectedCallback() {
        super.connectedCallback();
        this._restoreData();
        this.ownerDocument.addEventListener('mousedown', this._clearProseMirrorNodeSelection);
    }

    disconnectedCallback() {
        this._flushSaves();
        this.ownerDocument.removeEventListener('mousedown', this._clearProseMirrorNodeSelection);
        super.disconnectedCallback();
    }

    protected updated(changed: Map<PropertyKey, unknown>) {
        super.updated(changed);
        const dataChanged = ['classSettings', 'objectSettings', 'sequenceSettings', 'globalSettings', 'sequenceModelData', 'classDiagramData', 'objectDiagramData'].some((key) => changed.has(key));
        if (this.hasUpdated && dataChanged && !this._skipDataWrite) {
            this._writeData();
        }
        if (dataChanged) this._skipDataWrite = false;
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

    openSettings() {
        this.settingsOpen = true;
    }

    // --------------------------------------------------------------------------------------------------------
    // Conversions
    // --------------------------------------------------------------------------------------------------------

    /** The shown diagram as PlantUML text and as SVG, or `null` values when it is empty */
    private _shownDiagram(): { puml: string | null; svg: string | null } {
        this._flushSaves();
        const title = this.msg("UML diagram");
        if (this.diagramType === 'sequence-diagram') {
            return { puml: sequenceToPlantUml(this.sequenceModelData), svg: sequenceToSvg(this.sequenceModelData, title) };
        }
        const diagram = new ClassDiagram();
        diagram.load(this.diagramType === 'object-diagram' ? this.objectDiagramData : this.classDiagramData);
        return { puml: classDiagramToPlantUml(diagram), svg: classDiagramToSvg(diagram, title) };
    }

    /** Replaces the shown diagram with a parsed PlantUML diagram and shows it */
    private _applyPlantUml(result: PlantUmlResult) {
        clearTimeout(this._saveTimeout);
        this._pendingSaves.clear();
        const flag = result.kind === 'sequence' ? 'sequenceDiagramEnabled' : result.kind === 'object' ? 'objectDiagramEnabled' : 'classDiagramEnabled';
        if (!this.globalSettings[flag]) this.globalSettings = { ...this.globalSettings, [flag]: true };
        if (result.kind === 'sequence') this.sequenceModelData = result.model;
        else if (result.kind === 'object') this.objectDiagramData = result.json;
        else this.classDiagramData = result.json;
        this.diagramType = `${result.kind}-diagram`;
    }

    /** @internal Takes over PlantUML text from a `pre`; declines text that holds no diagram */
    loadPlantUmlText(fragment: DocumentFragment): boolean {
        try {
            this._applyPlantUml(parsePlantUml(fragment.textContent ?? "", this.msg));
            return true;
        } catch {
            return false;
        }
    }

    /** @internal Reads a PlantUML file completely and returns the function that applies it */
    async importPlantUml(file: File): Promise<() => void> {
        const result = parsePlantUml(await file.text(), this.msg);
        return () => this._applyPlantUml(result);
    }

    /** @internal The shown diagram as a `pre` with PlantUML text */
    toPlantUmlText(): HTMLElement | null {
        const puml = this._shownDiagram().puml;
        if (!puml) return null;
        const pre = this.ownerDocument.createElement("pre");
        pre.textContent = puml;
        return pre;
    }

    /** @internal The shown diagram as an `img` with an SVG data URL */
    toImage(): HTMLElement | null {
        const svg = this._shownDiagram().svg;
        if (!svg) return null;
        const img = this.ownerDocument.createElement("img");
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        img.alt = this.msg("UML diagram");
        return img;
    }

    /** @internal The shown diagram as a PlantUML file */
    exportPlantUml(): File | null {
        const puml = this._shownDiagram().puml;
        return puml ? new File([puml], "uml-diagram.puml", { type: "text/plain" }) : null;
    }

    /** @internal The shown diagram as an SVG file */
    exportSvg(): File | null {
        const svg = this._shownDiagram().svg;
        return svg ? new File([svg], "uml-diagram.svg", { type: "image/svg+xml" }) : null;
    }

    /** @internal The settings and all diagrams as a JSON file */
    exportJson(): File {
        this._flushSaves();
        const parse = (value: string) => { try { return JSON.parse(value); } catch { return value; } };
        const content = {
            classSettings: this.classSettings,
            objectSettings: this.objectSettings,
            sequenceSettings: this.sequenceSettings,
            globalSettings: this.globalSettings,
            sequenceModelData: this.sequenceModelData,
            classDiagramData: parse(this.classDiagramData),
            objectDiagramData: parse(this.objectDiagramData),
        };
        return new File([JSON.stringify(content, null, 2)], "uml-diagram.json", { type: "application/json" });
    }

    /** @internal Reads a JSON file completely and returns the function that applies it */
    async importJson(file: File): Promise<() => void> {
        let data: Record<string, any>;
        try {
            data = JSON.parse(await file.text());
        } catch {
            throw new Error(this.msg("The file is not valid JSON."));
        }
        const isObject = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value);
        const model = data?.sequenceModelData;
        const valid = isObject(data)
            && ["classSettings", "objectSettings", "sequenceSettings", "globalSettings"].every(key => data[key] === undefined || isObject(data[key]))
            && (model === undefined || (isObject(model) && Array.isArray(model.lifelines) && Array.isArray(model.messages) && Array.isArray(model.fragments ?? [])))
            && ["classDiagramData", "objectDiagramData"].every(key => data[key] === undefined || typeof data[key] === "string" || isObject(data[key]))
            && ["classSettings", "objectSettings", "sequenceSettings", "globalSettings", "sequenceModelData", "classDiagramData", "objectDiagramData"].some(key => data[key] !== undefined);
        if (!valid) throw new Error(this.msg("The file does not hold UML diagram data."));
        return () => {
            clearTimeout(this._saveTimeout);
            this._pendingSaves.clear();
            this._restoreData(data);
            this._skipDataWrite = false;
            this.requestUpdate();
        };
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
                    part="tabs"
                    .active=${this.diagramType}
                    .globalSettings=${this.globalSettings}
                    ?fullscreen=${this.isFullscreen}
                    @select-diagram=${(e: CustomEvent) => this._handleChangeDiagram(e.detail.type)}
                ></diagram-tabs>

                <div part="frame" class="frame ${this.diagramType === firstTabType ? 'first-tab-active' : ''}">
                    <div 
                        class="diagram-wrapper" 
                        style="${hideSequenceDiagram}"
                    >
                        <sequence-diagram-container
                            .settings=${this.sequenceSettings}
                            .globalSettings=${this.globalSettings}
                            .model=${this.sequenceModelData}
                            .checkpoint=${this._sequenceDiagramCheckpoint}
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
                            @diagram-data-changed=${this._handleDiagramDataChanged}
                            @toggle-fullscreen=${this._handleToggleFullscreen}
                            .isFullscreen=${this.isFullscreen}
                        ></class-object-container>
                    </div>
                </div>
            </div>

            <dialog style="max-width: min(56rem, 90vw); max-height: 85vh; overflow: auto" ?open=${this.settingsOpen} @close=${() => this.settingsOpen = false}>
                <button type="button" @click=${() => this.settingsOpen = false}>${this.msg("Close")}</button>
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
