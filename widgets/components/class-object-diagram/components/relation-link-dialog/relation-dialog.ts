import { html, svg } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { query, state, property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { live } from 'lit/directives/live.js';
import { SlButton, SlDialog, SlInput, SlIcon, SlDivider } from "@shoelace-style/shoelace";
import styles from "./relation-dialog.styles";
import { ClassSettings } from "../../models/class-settings-model";
import trashIcon from "@tabler/icons/outline/trash.svg";
import plusIcon from "@tabler/icons/outline/plus.svg";
import { GlobalSettings } from "../../../global-settings/global-settings-model";
import { arrowMarkers } from "../../../shared/arrow-markers";

/** Interface for the structure of Validation Issues */
interface ValidationIssue {
    target: string;
    message: string;
    settingKey: keyof ClassSettings;
}

/** Interface for the data passed to the dialog */
export interface RelationDialogData {
    id: string; 
    type: string; 
    sourceClassName: string;
    targetClassName: string;
    data: {
        name: string;
        sourceMultiplicity: string;
        targetMultiplicity: string;
        sourceRole: string;
        targetRole: string;
    };
}

/** 
 * Dialog component for editing relation properties and to add association classes incl a live visual preview 
 * of the connection 
 */
@localized()
export class RelationDialog extends LitElementWw {

    /** Styles defined in relation-dialog.styles.ts */
    static styles = [styles];

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-dialog": SlDialog,
            "sl-input": SlInput,
            "sl-button": SlButton,
            "sl-icon": SlIcon,
            "sl-divider": SlDivider
        };
    }
    
    /** Reference to the sl-dialog element to open and close it programmatically */
    @query("#relation-dialog") accessor dialog!: any;

    /** Property for the passed down class or object settings */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Property for the passed down current diagram type */
    @property({ type: String }) accessor diagramType: string = 'class-diagram';

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** empty state for initial dialog to make it always active (otherwise it doesn't open first try)*/
    @state() private _dialogData: RelationDialogData = {
        id: '',
        type: 'association',
        sourceClassName: '',
        targetClassName: '',
        data: {
            name: '',
            sourceMultiplicity: '',
            targetMultiplicity: '',
            sourceRole: '',
            targetRole: ''
        }
    };

    /** State to store which fields are already visited to show validation errors */
    @state() private _touchedFields = new Set<string>();

    /** State to store the focused field to prevent validation errors from beeing shown */
    @state() private _focusedField: string | null = null;

    /** Add visited fields to the list of fields where the error is shown */
    private _handleBlur(targetId: string) {
        this._focusedField = null;
        const newSet = new Set(this._touchedFields);
        newSet.add(targetId);
        this._touchedFields = newSet;
        this.requestUpdate();
    }

    /** Prevent activly focused fields from showing validation errors */
    private _handleFocus(targetId: string) { 
        this._focusedField = targetId;
        this.requestUpdate();
    }

    // --------------------------------------------------------------------------------------------------------
    // Open and Close the Dialog window
    // --------------------------------------------------------------------------------------------------------

    /** Opens the dialog with the provided data */
    public show(data: RelationDialogData) {
        // Deep copy to avoid mutating the original object directly before saving
        this._dialogData = JSON.parse(JSON.stringify(data));
        this.requestUpdate();
        this._touchedFields = new Set<string>();
        this.dialog.show();
    }

    /** Closes the dialog */
    public hide() {
        this.dialog.hide();
    }


    // --------------------------------------------------------------------------------------------------------
    // Handlers
    // --------------------------------------------------------------------------------------------------------

    /** Dispatch save event to send modified data to the main widget and close */
    private _save() {
        if (!this._dialogData) return;

        // check for invalid input
        const activeIssues = this._activeIssues;
        if (activeIssues.length > 0) {
            alert(activeIssues.map(i => i.message).join('\n'));
            return;
        }

        // Dispatch event to store changes
        this.dispatchEvent(new CustomEvent('save-relation', {
            detail: {
                id: this._dialogData.id,
                data: {
                    relationName: this._dialogData.data.name,
                    sourceMultiplicity: this._dialogData.data.sourceMultiplicity,
                    targetMultiplicity: this._dialogData.data.targetMultiplicity,
                    sourceRole: this._dialogData.data.sourceRole,
                    targetRole: this._dialogData.data.targetRole
                }
            },
            bubbles: true,
            composed: true
        }));

        // close the dialog
        this.hide();
    }

    /** Special handler for Associations: Save and creating an Association Class */
    private _saveAndAddClass() {
        if (!this._dialogData) return;

        // check for invalid input
        const activeIssues = this._activeIssues;
        if (activeIssues.length > 0) {
            alert(activeIssues.map(i => i.message).join('\n'));
            return;
        }

        // Dispatch event to store changes and add association class
        this.dispatchEvent(new CustomEvent('save-and-add-class', {
            detail: {
                id: this._dialogData.id,
                data: {
                    relationName: this._dialogData.data.name,
                    sourceMultiplicity: this._dialogData.data.sourceMultiplicity,
                    targetMultiplicity: this._dialogData.data.targetMultiplicity,
                    sourceRole: this._dialogData.data.sourceRole,
                    targetRole: this._dialogData.data.targetRole
                }
            },
            bubbles: true,
            composed: true
        }));

        // close the dialog window
        this.hide();
    }

    /** Dispatch an event to delet a relation */
    private _delete() {
        if (!this._dialogData) return;

        this.dispatchEvent(new CustomEvent('delete-relation', {
            detail: {
                id: this._dialogData.id
            },
            bubbles: true,
            composed: true
        }));

        this.hide();
    }

    /** Live update of local state on input change to show in preview */
    private _handleInputChange(field: 'name' | 'sourceMultiplicity' | 'targetMultiplicity' | 'sourceRole' | 'targetRole', e: any) {
        if (!this._dialogData) return;
        
        this._dialogData = {
            ...this._dialogData,
            data: {
                ...this._dialogData.data,
                [field]: e.target.value
            }
        };
        this.requestUpdate();
    }

    // --------------------------------------------------------------------------------------------------------
    // Validation logic
    // --------------------------------------------------------------------------------------------------------

    /** Checks for valid multiplicity (empty or correct format while ignoring whitespaces)*/
    private _isValidMultiplicity(value: string): boolean {
        if (!value || value.trim() === "") return true;
        const clean = value.replace(/\s/g, "");
        const regex = /^(\d+|(\*)|(\d+\.\.(\d+|\*)))$/;
        return regex.test(clean);
    }

    /** Collects all possible validation issues for the current relation */
    private _getAllValidationIssues(): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        if (!this._dialogData) return issues;

        const sMult = this._dialogData.data.sourceMultiplicity;
        const tMult = this._dialogData.data.targetMultiplicity;
        const name = this._dialogData.data.name;
        const type = this._dialogData.type;

        // checkRelationMultiplicitySyntax
        if (!this._isValidMultiplicity(sMult)) {
            issues.push({
                target: 'sourceMultiplicity',
                message: msg("Invalid Source Multiplicity. Allowed formats: '1', '0..1', '*', '1..*'"),
                settingKey: 'checkRelationMultiplicitySyntax'
            });
        }
        if (!this._isValidMultiplicity(tMult)) {
            issues.push({
                target: 'targetMultiplicity',
                message: msg("Invalid Target Multiplicity. Allowed formats: '1', '0..1', '*', '1..*'"),
                settingKey: 'checkRelationMultiplicitySyntax'
            });
        }

        // checkDependencyStereotypeSyntax
        if (type === 'dependency' && name && name.trim() !== '') {
            const stereotypeRegex = /^(<<.+>>|«.+»)$/;
            if (!stereotypeRegex.test(name.trim())) {
                issues.push({
                    target: 'name',
                    message: msg("Dependency stereotypes must be wrapped in << >> or « »."),
                    settingKey: 'checkDependencyStereotypeSyntax'
                });
            }
        }

        return issues;
    }

    /** Filters validation issues based on the global validation mode */
    private get _activeIssues(): ValidationIssue[] {
        const allIssues = this._getAllValidationIssues();

        if (this.globalSettings.validationMode === 'off') return [];
        if (this.globalSettings.validationMode === 'all') return allIssues;

        return allIssues.filter(issue =>
            (this.settings as any)[issue.settingKey] === true
        );
    }

    // --------------------------------------------------------------------------------------------------------
    // Render method and rendering helper methods
    // --------------------------------------------------------------------------------------------------------

    /** renders the preview of the relation using the svg template to ensure correctnes */
    private _renderPreview() {
        if (!this._dialogData) return html``;

        const { type, data, sourceClassName, targetClassName } = this._dialogData;

        // arrow line style (dashed or not)
        const isDashed = ['dependency', 'realization'].includes(type);
        const dashArray = isDashed ? "10,5" : "none";

        // arrow heads
        let markerStartId = "none";
        let markerEndId = "none";

        if (type === 'association') {
            markerEndId = "arrow-open";         
        } else if (type === 'association-bidirectional') {
            markerStartId = "arrow-open"; 
            markerEndId = "arrow-open";      
        } else if (type === 'association-undirected') {
            markerStartId = "none";
            markerEndId = "none";
        } else if (type === 'dependency') {
            markerEndId = "arrow-open";
        } else if (['inheritance', 'realization'].includes(type)) {
            markerEndId = "arrow-triangle";
        } else if (type === 'aggregation') {
            markerEndId = "arrow-diamond-hollow";
        } else if (type === 'composition') {
            markerEndId = "arrow-diamond-filled";
        }

        const showName = ['association', 'association-bidirectional', 'association-undirected', 'dependency'].includes(type);
        const displayName = data.name;

        // positions for lines and labels
        const lineY = 40;
        const topTextY = 25;   
        const bottomTextY = 55; 

        // create actual prview
        return html`
            <div class="preview-container">
                <div class="preview-box">
                    ${sourceClassName}
                </div>

                <div class="preview-connection">
                    ${svg`
                        <svg width="100%" height="80" style="overflow: visible;">
                            <defs>${arrowMarkers(1.5)}</defs>

                            <line 
                                x1="0" y1="${lineY}" x2="100%" y2="${lineY}" 
                                stroke="var(--sl-color-neutral-900)" 
                                stroke-width="1.5" 
                                stroke-dasharray="${dashArray}"
                                marker-start="url(#${markerStartId})"
                                marker-end="url(#${markerEndId})" 
                            />
                            
                            <text x="5%" y="${topTextY}" text-anchor="start" dominant-baseline="auto">
                                ${data.sourceMultiplicity}
                            </text>
                            <text x="95%" y="${topTextY}" text-anchor="end" dominant-baseline="auto">
                                ${data.targetMultiplicity}
                            </text>

                            <text x="5%" y="${bottomTextY}" text-anchor="start" dominant-baseline="hanging">
                                ${data.sourceRole}
                            </text>
                            <text x="95%" y="${bottomTextY}" text-anchor="end" dominant-baseline="hanging">
                                ${data.targetRole}
                            </text>

                            ${showName ? svg`
                                <text x="50%" y="${topTextY}" text-anchor="middle" dominant-baseline="auto">
                                    ${displayName}
                                </text>
                            ` : ''}
                        </svg>
                    `}
                </div>

                <div class="preview-box">
                    ${targetClassName}
                </div>
            </div>
        `;
    }

    render() {

        const type = this._dialogData.type;
        
        // Determine which input fields to show based on relation type
        const showProperties = [
            'association', 
            'association-bidirectional', 
            'association-undirected', 
            'composition', 
            'aggregation'
        ].includes(type);

        const showName = [
            'association', 
            'association-bidirectional', 
            'association-undirected', 
            'dependency'
        ].includes(type);

        const isObjectDiagram = this.diagramType === 'object-diagram';

        const nameLabel = type === 'dependency' ? msg("Stereotype") : msg("Relation Name");

        return html`
            <sl-dialog 
                id="relation-dialog" 
                label="${msg('Edit')} ${type.charAt(0).toUpperCase() + type.slice(1)}"
                @sl-request-close=${(e: CustomEvent) => {
                    if (e.detail.source === 'overlay') e.preventDefault();
                }}
                @sl-show=${(e: any) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('dialog-opened', { bubbles: true, composed: true })); }}
                @sl-after-hide=${(e: any) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('dialog-closed', { bubbles: true, composed: true })); }}
            >
                
                ${this._renderPreview()}

                <div style="display: flex; flex-direction: column; gap: 15px;">

                    ${showName ? html`
                        <sl-input 
                            autocomplete="off"
                            label="${nameLabel}" 
                            class=${this._focusedField !== 'name' && this._touchedFields.has('name') && this._activeIssues.find(i => i.target === 'name') ? 'has-error' : ''}
                            .value=${live(this._dialogData.data.name)}
                            @sl-input=${(e: any) => this._handleInputChange('name', e)}
                            @sl-blur=${(e: any) => { this._handleInputChange('name', { target: { value: e.target.value.trim() } }); this._handleBlur('name'); }}
                            @sl-focus=${() => this._handleFocus('name')}
                        ></sl-input>
                        ${this._focusedField !== 'name' && this._touchedFields.has('name') && this._activeIssues.find(i => i.target === 'name') ? html`
                            <div style="color: var(--sl-color-danger-600); font-size: var(--sl-font-size-small); margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                <sl-icon name="exclamation-triangle"></sl-icon>
                                ${this._activeIssues.find(i => i.target === 'name')?.message}
                            </div>
                        ` : ''}
                    ` : ''}

                    ${showProperties ? html`
                        <div style="display: flex; gap: 15px;">
                            
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                                <span style="font-size: var(--sl-font-size-small); font-weight: bold; color: var(--sl-color-neutral-600);">${msg("Source")}</span>
                                <sl-input 
                                    autocomplete="off"
                                    label="${msg('Role')}" 
                                    .value=${live(this._dialogData.data.sourceRole)}
                                    @sl-input=${(e: any) => this._handleInputChange('sourceRole', e)}
                                ></sl-input>
                                ${!isObjectDiagram ? html`
                                    <sl-input 
                                        autocomplete="off"
                                        class=${this._focusedField !== 'sourceMultiplicity' && this._touchedFields.has('sourceMultiplicity') && this._activeIssues.find(i => i.target === 'sourceMultiplicity') ? 'has-error' : ''}
                                        label="${msg('Multiplicity')}" 
                                        .value=${live(this._dialogData.data.sourceMultiplicity)}
                                        @sl-input=${(e: any) => this._handleInputChange('sourceMultiplicity', e)}
                                        @sl-blur=${(e: any) => { this._handleInputChange('sourceMultiplicity', { target: { value: e.target.value.trim() } }); this._handleBlur('sourceMultiplicity'); }}
                                        @sl-focus=${() => this._handleFocus('sourceMultiplicity')}
                                    ></sl-input>
                                    ${this._focusedField !== 'sourceMultiplicity' && this._touchedFields.has('sourceMultiplicity') && this._activeIssues.find(i => i.target === 'sourceMultiplicity') ? html`
                                        <div style="color: var(--sl-color-danger-600); font-size: var(--sl-font-size-small); margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                            <sl-icon name="exclamation-triangle"></sl-icon>
                                            ${this._activeIssues.find(i => i.target === 'sourceMultiplicity')?.message}
                                        </div>
                                    ` : ''}
                                ` : ''}
                            </div>

                            <sl-divider vertical style="height: auto;"></sl-divider>

                            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                                <span style="font-size: var(--sl-font-size-small); font-weight: bold; color: var(--sl-color-neutral-600);">${msg("Target")}</span>
                                <sl-input 
                                    autocomplete="off"
                                    label="${msg('Role')}" 
                                    .value=${live(this._dialogData.data.targetRole)}
                                    @sl-input=${(e: any) => this._handleInputChange('targetRole', e)}
                                ></sl-input>
                                ${!isObjectDiagram ? html`
                                    <sl-input 
                                        autocomplete="off"
                                        class=${this._focusedField !== 'targetMultiplicity' && this._touchedFields.has('targetMultiplicity') && this._activeIssues.find(i => i.target === 'targetMultiplicity') ? 'has-error' : ''}
                                        label="${msg('Multiplicity')}" 
                                        .value=${live(this._dialogData.data.targetMultiplicity)}
                                        @sl-input=${(e: any) => this._handleInputChange('targetMultiplicity', e)}
                                        @sl-blur=${(e: any) => { this._handleInputChange('targetMultiplicity', { target: { value: e.target.value.trim() } }); this._handleBlur('targetMultiplicity'); }}
                                        @sl-focus=${() => this._handleFocus('targetMultiplicity')}
                                    ></sl-input>
                                    ${this._focusedField !== 'targetMultiplicity' && this._touchedFields.has('targetMultiplicity') && this._activeIssues.find(i => i.target === 'targetMultiplicity') ? html`
                                        <div style="color: var(--sl-color-danger-600); font-size: var(--sl-font-size-small); margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                            <sl-icon name="exclamation-triangle"></sl-icon>
                                            ${this._activeIssues.find(i => i.target === 'targetMultiplicity')?.message}
                                        </div>
                                    ` : ''}
                                ` : ''}
                            </div>

                        </div>
                    ` : ''}

                    ${(!showName && !showProperties) ? html`
                        <p style="color: var(--sl-color-neutral-500); font-style: italic; text-align: center;">
                            ${msg("This relation type has no editable properties")}
                        </p>
                    ` : ''}

                </div>

                <div slot="footer" class="footer-container">
                    <sl-button variant="danger" outline @click=${this._delete}>
                        <sl-icon slot="prefix" src=${trashIcon}></sl-icon>
                        ${msg("Delete")}
                    </sl-button>

                    <div style="display: flex; gap: 10px;">
                        
                        ${((type === 'association' || type === 'association-bidirectional' || type === 'association-undirected') && !isObjectDiagram) ? html`
                            <sl-button @click=${this._saveAndAddClass}>
                                <sl-icon slot="prefix" src=${plusIcon}></sl-icon>
                                ${msg("Assoc. Class & Save")}
                            </sl-button>
                        ` : ''}
                        
                        <sl-button variant="primary" @click=${this._save}>
                            ${msg("Save")}
                        </sl-button>
                    </div>
                </div>

            </sl-dialog>
        `;
    }
}