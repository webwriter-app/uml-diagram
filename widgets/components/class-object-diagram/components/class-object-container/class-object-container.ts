import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property, query, state } from "lit/decorators.js";
import { localized } from "@lit/localize";
import { ClassToolbar } from "../toolbar/class-toolbar";
import { UMLEditor } from "../editor/uml-editor";
import { ClassSettings } from "../../models/class-settings-model";
import styles from "./class-object-container.styles";
import { GlobalSettings } from "../../../global-settings/global-settings-model";
import { resetDiagramConfirmOptions } from "../../../shared/confirm-dialog";

/** Container for the Class or Object Diagram (middleman to manage interaction) */
@localized()
export class ClassObjectContainer extends LitElementWw {

    /** Register used Elements */
    static get scopedElements() {
        return {
            "class-toolbar": ClassToolbar,
            "uml-editor": UMLEditor
        };
    }

    /** Styles are set in separate file (./class-object-container.styles.ts) */
    static styles = [styles];

    /** Accessor for the uml-editor */
    @query("uml-editor") accessor editor!: UMLEditor;

    /** Property to receive the current diagram type from the main widget */
    @property({ type: String }) accessor diagramType: string = "class-diagram";

    /** Property to receive the settings from the main widget */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Serialized Drawflow diagram state, passed down from the main widget to restore the diagram on load */
    @property({ attribute: false }) accessor savedDiagramData: any = null;

    /** property for the state of the checkpoint learners can return to */
    @property({attribute: false}) accessor checkpoint: any = null;

    /** Indicates whether the widget is currently in fullscreen mode */
    @property({ type: Boolean }) accessor isFullscreen: boolean = false;

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** Current number of classes in the diagram */
    @state() private accessor currentClassCount: number = 0;

    /** Current number of relations in the diagram */
    @state() private accessor currentRelationCount: number = 0;

    /** state to store if a dialog is open to deactivate the toolbar */
    @state() private accessor _dialogOpen: boolean = false;

    // --------------------------------------------------------------------------------------------------------
    // Handlers
    // --------------------------------------------------------------------------------------------------------

    /** Handler if the toolbar sends notification to add a new class (with given type) */
    private _handleClassAdd(e: CustomEvent) {
        const type = e.detail.type;
        if (this.editor) {
            this.editor.addClassNode("NewClass", type);
        }
    }

    /** Handler if the toolbar sends notification to add a new object */
    private _handleObjectAdd(e: CustomEvent) {
        const type = e.detail?.type || 'object';
        
        let name = "NewObject";
        if (type === 'enum') name = "NewEnum";
        if (type === 'datatype') name = "NewDataType";
        
        if (this.editor) {
            this.editor.addClassNode(name, type);
        }
    }

    /** Handler if the toolbar sends notification to add a new relation */
    private _handleRelationAdd(e: CustomEvent) {
        const type = e.detail.type;
        if (this.editor) {
            this.editor._addRelation(type);
        }
    }

    /** Updates the class and relation counts for the toolbar */
    private _handleCountsChanged(e: CustomEvent) {
        const { classCount, relationCount } = e.detail;
        if (classCount !== undefined) this.currentClassCount = classCount;
        if (relationCount !== undefined) this.currentRelationCount = relationCount;
    }

    /** Handler for diagram data changes – persists data and updates counts */
    private _handleDiagramDataChanged(e: CustomEvent) {
        this._handleCountsChanged(e);
        setTimeout(() => this.dispatchEvent(new CustomEvent('diagram-data-changed', {
            detail: e.detail,
            bubbles: true,
            composed: true
        })), 0);
    }
  
    /** Handler if the toolbar sends notification to clear the canvas */
    private async _handleClear() {
        if (!this.editor) return;
        const toCheckpoint = !!(this.globalSettings.useCheckpoint && this.checkpoint && this.contentEditable === undefined);
        if (!await this.editor.confirm(resetDiagramConfirmOptions(toCheckpoint))) return;
        if (toCheckpoint) {
            this.editor.loadCheckpoint(this.checkpoint);
        } else {
            this.editor.clearCanvas();
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // render method
    // --------------------------------------------------------------------------------------------------------

    render() {
        return html`
            <class-toolbar
                .diagramType=${this.diagramType}
                .settings=${this.settings}
                .currentClassCount=${this.currentClassCount}
                .currentRelationCount=${this.currentRelationCount}
                ?dialogopen=${this._dialogOpen}
                @addClass=${this._handleClassAdd}
                @addObject=${this._handleObjectAdd}
                @addRelation=${this._handleRelationAdd}
                @clearCanvas=${this._handleClear}
            ></class-toolbar>

            <div class="editor-wrapper">
                <uml-editor 
                    .settings=${this.settings} 
                    .globalSettings=${this.globalSettings}
                    .diagramType=${this.diagramType}
                    .savedDiagramData=${this.savedDiagramData}
                    .isFullscreen=${this.isFullscreen}
                    @diagram-data-changed=${this._handleDiagramDataChanged}
                    @diagram-counts-changed=${this._handleCountsChanged}
                    @dialog-opened=${() => {this._dialogOpen = true;}}
                    @dialog-closed=${() => this._dialogOpen = false}
                ></uml-editor>
            </div>
        `;
    }
}