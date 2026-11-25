import { LitElementWw } from "@webwriter/lit";
import { widgetMsg } from "@webwriter/lit/localize";
import { html } from "lit";
import { query, state, property } from "lit/decorators.js";
import { ClassModel, ClassAttribute, ClassMethod } from "../../model/class-object-diagram/class-model";
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import { addAttribute, updateAttribute, removeAttribute, addMethod, updateMethod, removeMethod, addParameter, updateParameter, removeParameter, addEnumValue, updateEnumValue, removeEnumValue } from "../../model/class-object-diagram/class-edits";
import { getClassValidationIssues, type ValidationIssue, type RelationConstraint } from "../../model/class-object-diagram/class-validation";
import { ClassSettings } from "../../model/class-object-diagram/class-settings-model";
import { default as SlButton } from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import { default as SlDialog } from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import { default as SlInput } from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import { default as SlRadio } from "@shoelace-style/shoelace/dist/components/radio/radio.component.js";
import { default as SlOption } from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import { default as SlSelect } from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { default as SlIcon } from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { default as SlSwitch } from "@shoelace-style/shoelace/dist/components/switch/switch.component.js";
import { default as SlPopup } from "@shoelace-style/shoelace/dist/components/popup/popup.component.js";
import styles from "./class-dialog.styles";
import xIcon from "@tabler/icons/outline/x.svg";
import alertTriangleIcon from "@tabler/icons/outline/alert-triangle.svg";
import plusIcon from "@tabler/icons/outline/plus.svg";
import trashIcon from "@tabler/icons/outline/trash.svg";
import { GlobalSettings } from "../../model/global-settings/global-settings-model";

/** Defines a dialog for editing classes/objects */
export class ClassDialog extends LitElementWw {
    msg = widgetMsg(this);

    /** Styles are set in seperate file (./class-dialog.styles.ts) */
    static styles = [styles];

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-dialog": SlDialog,
            "sl-input": SlInput,
            "sl-button": SlButton,
            "sl-radio": SlRadio,  
            "sl-option": SlOption,
            "sl-select": SlSelect,
            "sl-icon": SlIcon,
            "sl-switch": SlSwitch,
            "sl-popup": SlPopup,
        };
    }

    // --------------------------------------------------------------------------------------------------------
    // References
    // --------------------------------------------------------------------------------------------------------

    /** Reference to the sl-dialog element to open/close it programmatically */
    @query("#edit-dialog") accessor dialog!: SlDialog;

    /** stores the Id of the node that is edited */
    @state() private accessor _selectedNodeId: string | null = null;

    /** Stores fields that were already touched to show validation errors if active */
    @state() private accessor _touchedFields = new Set<string>();

    /** Gets activated to show all Errors if still existent when trying to save */
    @state() private accessor _showAllErrors = false;

    /** List of already existing Names for validating new names (to don't use a name twice) */
    @state() private accessor _existingNames: string[] = [];

    /** Stores relations of the class to check if validation rules are broken (if active) */
    @state() private accessor _constraints: RelationConstraint[] = [];

    /** Property to store the passed down class- or object- settings */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Property to store the passed down diagram type */
    @property({ type: String }) accessor diagramType: string = 'class-diagram';

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** Inital Data for the dialog to make it always active (otherwise it doesn't open the first time) */
    @state() private accessor _editingNodeData: ClassModel = {
        type: 'standard',
        name: '',
        attributes: [],
        methods: [],
        objectName: '',
        enumValues: [],
        associatedConnectionId: ''
    }; 

    /** state to store the currently focused field to stop validation-text from beeing displayed */
    @state() private accessor _focusedField: string | null = null;

    // --------------------------------------------------------------------------------------------------------
    // Control and Lifecycle
    // --------------------------------------------------------------------------------------------------------

    /** Open class editing dialog for given class (sets all relevant states) */
    public show(id: string, data: ClassModel, existingNames: string[] = [], constraints: RelationConstraint[] = []) {
        this._selectedNodeId = id;
        this._editingNodeData = JSON.parse(JSON.stringify(data));
        this._touchedFields = new Set<string>();
        this._showAllErrors = false;
        this._constraints = constraints;
        this._existingNames = existingNames;
        this.requestUpdate();
        this.dialog.show();
    }

    /** Hide the Dialog */
    public hide() {
        this.dialog.hide();
    }

    /** Checks if issues with the validation are left and stores changed data if not and closes the dialog */
    private async _save() {
        if (!this._selectedNodeId || !this._editingNodeData) return;
        // Checks for validation errors and stop the process if there are some
        if (this._activeIssues.length > 0) {
            this._showAllErrors = true;
            await this.updateComplete;
            this.shadowRoot?.querySelector('.has-error')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return;
        }

        // Safe if no validation errors are found
        this.dispatchEvent(new CustomEvent('save-class', {
            detail: {
                id: this._selectedNodeId,
                data: this._editingNodeData
            },
            bubbles: true,
            composed: true
        }));

        // Close the dialog
        this.hide();
    }

    /** Delete the class that is currently edited */
    private _delete() {
        if (!this._selectedNodeId || !this._editingNodeData) return;

        // inform the widget about the delete
        this.dispatchEvent(new CustomEvent('delete-class', {
            detail: {
                id: this._selectedNodeId
            },
            bubbles: true,
            composed: true
        }));

        // close the dialog
        this.hide();
    }

    /** Reset states when dialog is closed */
    private _handleAfterHide(e: CustomEvent) {
        if (e.target === e.currentTarget) {
            this._editingNodeData = {
                type: 'standard',
                name: '',
                attributes: [],
                methods: [],
                objectName: '',
                enumValues: [],
                associatedConnectionId: ''
            };
            this._selectedNodeId = null;
        }
        this.dispatchEvent(new CustomEvent('dialog-closed', { bubbles: true, composed: true }));
    }

    // --------------------------------------------------------------------------------------------------------
    // Data Changes
    // --------------------------------------------------------------------------------------------------------

    /** Apply a pure edit to the class being edited */
    private _edit(change: (d: ClassModel) => ClassModel) {
        if (!this._editingNodeData) return;
        this._editingNodeData = change(this._editingNodeData);
        this.requestUpdate();
    }

    /** Add empty new attribute */
    private _addAttribute() { this._edit(addAttribute); }

    /** Update the content of a given attribute */
    private _updateAttribute(index: number, field: keyof ClassAttribute, value: string | boolean) {
        this._edit(d => updateAttribute(d, index, field, value));
    }

    /** Delete the selected attribute from the class */
    private _removeAttribute(index: number) { this._edit(d => removeAttribute(d, index)); }

    /** Add empty new method */
    private _addMethod() { this._edit(addMethod); }

    /** Update the content of a given method */
    private _updateMethod(index: number, field: keyof ClassMethod, value: string | boolean) {
        this._edit(d => updateMethod(d, index, field, value));
    }

    /** Delete the selected method from the class */
    private _removeMethod(index: number) { this._edit(d => removeMethod(d, index)); }

    /** Add empty new parameter to the method */
    private _addParameter(methodIndex: number) { this._edit(d => addParameter(d, methodIndex)); }

    /** Update the content of a given parameter */
    private _updateParameter(methodIndex: number, paramIndex: number, field: 'name' | 'type', value: string) {
        this._edit(d => updateParameter(d, methodIndex, paramIndex, field, value));
    }

    /** Delete the selected parameter from the method */
    private _removeParameter(methodIndex: number, paramIndex: number) {
        this._edit(d => removeParameter(d, methodIndex, paramIndex));
    }

    /** Add an empty enum value */
    private _addEnumValue() { this._edit(addEnumValue); }

    /** Updates an emum value for a given index */
    private _updateEnumValue(index: number, value: string) { this._edit(d => updateEnumValue(d, index, value)); }

    /** Delete an enum value with a given index */
    private _removeEnumValue(index: number) { this._edit(d => removeEnumValue(d, index)); }

    /** Change the name of the class */
    private _handleNameChange(e: FieldEvent) {
        if (!this._editingNodeData) return;
        
        this._editingNodeData = {
            ...this._editingNodeData,
            name: e.target.value
        };
        this.requestUpdate();
    }

    /** Change the type of the class */
    private _handleTypeChange(e: FieldEvent) {
        if (!this._editingNodeData) return;
        
        this._editingNodeData = {
            ...this._editingNodeData,
            type: e.target.value as ClassModel["type"]
        };

        this.requestUpdate();
    }

    // --------------------------------------------------------------------------------------------------------
    // Validation
    // --------------------------------------------------------------------------------------------------------


    /** Stores fields as "touched" and requests an update so that validation errors can be shown */
    private _handleBlur(targetId: string) {
        this._focusedField = null;
        const newSet = new Set(this._touchedFields);
        newSet.add(targetId);
        this._touchedFields = newSet;
        this.requestUpdate();
    }

    /** stop validation error from beeing displayed for focused fields */
    private _handleFocus(targetId: string) { 
        this._focusedField = targetId;
        this.requestUpdate();
    }

    /** Checks for all validation rules if they are broken (also if not active in settings)  */
    private _getAllValidationIssues(): ValidationIssue[] {
        return this._editingNodeData ? getClassValidationIssues(this._editingNodeData, this._existingNames, this._constraints, this.msg) : [];
    }

    /** Filter validation issues only for the active validation rules */
    private get _activeIssues(): ValidationIssue[] {
        const allIssues = this._getAllValidationIssues();
        
        // 'off' = no validation rules active
        if (this.globalSettings.validationMode === 'off') {
            return [];
        }
        
        // 'all' = all validation rules active regardless of individual settings
        if (this.globalSettings.validationMode === 'all') {
            return allIssues;
        }
        
        // 'custom' = only rules enabled in individual settings
        return allIssues.filter(issue => {
            return (this.settings as any)[issue.settingKey] === true;
        });
    }

    // --------------------------------------------------------------------------------------------------------
    // render
    // --------------------------------------------------------------------------------------------------------

    render() {
        // Get issues and show them if wanted
        const issues = this._activeIssues;
        const shouldShowError = (targetId: string) => {
            if (this._focusedField === targetId) return null;
            const hasIssue = issues.find(i => i.target === targetId);
            if (!hasIssue) return null;

            if (this._showAllErrors || this._touchedFields.has(targetId)) {
                return hasIssue;
            }
            return null;
        };

        const isObjectDiagram = this.diagramType === 'object-diagram';
        
        const isObj = isObjectDiagram || this._editingNodeData.type === 'object';
        const isEnum = this._editingNodeData.type === 'enum';
        
        const showVis = !isObj || this.settings.showVisibilityInObjects;
        const showMods = !isObj || this.settings.showModifiersInObjects;
        const showMeths = (!isObj || this.settings.showMethodsInObjects) && 
                          this._editingNodeData.type !== 'annotation' && 
                          !isEnum;
        const showParams = !isObj || this.settings.showParametersInObjects;
        const showAttributes = !isEnum;

        return html`
            <sl-dialog 
                id="edit-dialog" 
                @sl-after-hide=${this._handleAfterHide}
                @sl-request-close=${(e: CustomEvent) => {
                    if (e.detail.source === 'overlay') e.preventDefault();
                }}
                @sl-show=${() => {
                    this.dispatchEvent(new CustomEvent('dialog-opened', { bubbles: true, composed: true }));
                }}
            >
            <span slot="label">
                ${isObjectDiagram ? this.msg("Object Editor") : this.msg("Class Editor")}
            </span>

                <div style="display: flex; flex-direction: column; gap: var(--sl-spacing-medium);">
                    
                    <div style="display: flex; gap: var(--sl-spacing-medium); align-items: flex-start;">
                        
                        ${isObj ? html`
                            <div style="flex: 1;">
                                <sl-input 
                                    id="edit-object-name"
                                    class=${shouldShowError('objectname') ? 'has-error' : ''}
                                    .value=${live(this._editingNodeData.objectName || '')}
                                    @sl-input=${(e: FieldEvent) => {
                                        this._editingNodeData = { ...this._editingNodeData, objectName: e.target.value };
                                        this.requestUpdate();
                                    }}
                                    @sl-blur=${(e: FieldEvent) => { this._editingNodeData = { ...this._editingNodeData, objectName: e.target.value.trim() }; this._handleBlur('objectname'); }}
                                    @sl-focus=${() => this._handleFocus(`objectname`)}
                                >
                                    <span slot="label">
                                        ${this.msg("Instance Name")}
                                    </span>
                                </sl-input>

                                ${shouldShowError('objectname') ? html`
                                    <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                        <sl-icon src=${alertTriangleIcon} style="font-size: 1em;"></sl-icon> 
                                        ${shouldShowError('objectname')?.message}
                                    </div>
                                ` : ''}

                            </div>
                        ` : ''}

                        <div style="flex: 1;">
                            <sl-input 
                                id="edit-name"
                                .value=${live(this._editingNodeData.name)}
                                @sl-input=${this._handleNameChange}
                                @sl-blur=${(e: FieldEvent) => { this._editingNodeData = { ...this._editingNodeData, name: e.target.value.trim() }; this._handleBlur('classname'); }}
                                @sl-focus=${() => this._handleFocus(`classname`)}
                                class=${shouldShowError('classname') ? 'has-error' : ''}
                            >
                                <span slot="label">
                                    ${isObj ? this.msg("Class Name") : this.msg("Name")}
                                </span>
                            </sl-input>
                            
                            ${shouldShowError('classname') ? html`
                                <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                    <sl-icon src=${alertTriangleIcon} style="font-size: 1em;"></sl-icon> 
                                    ${shouldShowError('classname')?.message}
                                </div>
                            ` : ''}
                        </div>
                        
                        ${!isObjectDiagram ? html`
                            <div style="flex: 1;">
                                <sl-select 
                                    id="edit-type" 
                                    style="width: 100%;"
                                    .value=${this._editingNodeData.type}
                                    @sl-change=${this._handleTypeChange}
                                    @sl-blur=${() => this._handleBlur(`classtype`)}
                                    @sl-focus=${() => this._handleFocus(`classtype`)}
                                    class=${shouldShowError('classtype') ? 'has-error' : ''}
                                >
                                    <span slot="label">
                                        ${this.msg("Type")}
                                    </span>
                                    ${this.settings.standardExists ? html`<sl-option value="standard">${this.msg("Standard")}</sl-option>` : ''}
                                    ${this.settings.abstractExists ? html`<sl-option value="abstract">${this.msg("Abstract")}</sl-option>` : ''}
                                    ${this.settings.interfaceExists ? html`<sl-option value="interface">${this.msg("Interface")}</sl-option>` : ''}
                                    ${this.settings.enumExists ? html`<sl-option value="enum">${this.msg("Enumeration")}</sl-option>` : ''}
                                    ${this.settings.objectExists ? html`<sl-option value="object">${this.msg("Object")}</sl-option>` : ''}
                                    ${this.settings.parameterizedExists ? html`<sl-option value="param-class">${this.msg("Parameterized")}</sl-option>` : ''}
                                    ${this.settings.recordExists ? html`<sl-option value="record">${this.msg("Record")}</sl-option>` : ''}
                                    ${this.settings.annotationExists ? html`<sl-option value="annotation">${this.msg("Annotation")}</sl-option>` : ''}
                                    ${this.settings.dataTypeExists ? html`<sl-option value="datatype">${this.msg("Data Type")}</sl-option>` : ''}
                                </sl-select>

                                ${shouldShowError('classtype') ? html`
                                    <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                        <sl-icon 
                                            src=${alertTriangleIcon} 
                                            style="font-size: 1em;"
                                        ></sl-icon> 
                                        ${shouldShowError('classtype')?.message}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>

                    ${showAttributes ? html`
                        <div class="dialog-section">
                            <strong style="font-size: var(--sl-font-size-medium);">
                                ${this.msg("Attributes")}
                            </strong>
                            <div 
                                id="attributes-list" 
                                style="display: flex; flex-direction: column; gap: 5px;"
                            >
                                ${repeat(this._editingNodeData.attributes, (_attr, i) => `attr-${i}`, (attr, i) => html`
                                    <div class="method-or-parameter-card">

                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                            
                                            ${showMods ? html`
                                                <div style="display: flex; gap: 8px; align-items: center;">
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${attr.isStatic} 
                                                        @sl-change=${(e: FieldEvent) => this._updateAttribute(i, 'isStatic', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            static
                                                        </span>
                                                    </sl-switch>
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${attr.isFinal} 
                                                        @sl-change=${(e: FieldEvent) => this._updateAttribute(i, 'isFinal', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            final
                                                        </span>
                                                    </sl-switch>
                                                    ${this._editingNodeData.type === 'param-class' ? html`
                                                        <sl-switch 
                                                            size="small" 
                                                            .checked=${attr.isParam} 
                                                            @sl-change=${(e: FieldEvent) => this._updateAttribute(i, 'isParam', e.target.checked)}
                                                        >
                                                            <span style="font-size: var(--sl-font-size-medium);">
                                                                ${this.msg("parameterized")}
                                                            </span>
                                                        </sl-switch>
                                                    ` : ''}
                                                </div>
                                            ` : html`<div></div>`}

                                            <sl-button 
                                                size="small" 
                                                variant="danger" 
                                                outline 
                                                @click=${() => this._removeAttribute(i)}
                                                title=${this.msg("Delete")}
                                                aria-label=${this.msg("Delete")}
                                            >
                                                <sl-icon src=${xIcon}></sl-icon>
                                            </sl-button>
                                        </div>

                                        <div style="display: flex; gap: 5px; align-items: center;">
                                            
                                            ${showVis ? html`
                                                <sl-select 
                                                    .value=${attr.visibility} 
                                                    style="flex: 1;" 
                                                    @sl-change=${(e: FieldEvent) => this._updateAttribute(i, 'visibility', e.target.value)}
                                                    @sl-blur=${() => this._handleBlur(`attr-${i}-vis`)}
                                                    @sl-focus=${() => this._handleFocus(`attr-${i}-vis`)}
                                                    class=${shouldShowError(`attr-${i}-vis`) ? 'has-error' : ''}
                                                >
                                                    <sl-option value="public">
                                                        public (+)
                                                    </sl-option>
                                                    ${this.settings.packageExists ? html`
                                                        <sl-option value="package">
                                                            package (~)
                                                        </sl-option>
                                                    ` : ''}           
                                                    <sl-option value="private">
                                                        private (-)
                                                    </sl-option>
                                                    ${this.settings.protectedExists ? html`
                                                        <sl-option value="protected">
                                                            protected (#)
                                                        </sl-option>
                                                    ` : ''}
                                                </sl-select>
                                            ` : ''}
                                            
                                            <sl-input 
                                                autocomplete="off"
                                                placeholder=${this.msg("Name")}
                                                style="flex: 1;"
                                                .value=${live(attr.name)} 
                                                @sl-input=${(e: FieldEvent) => this._updateAttribute(i, 'name', e.target.value)}
                                                @sl-blur=${(e: FieldEvent) => { this._updateAttribute(i, 'name', e.target.value.trim()); this._handleBlur(`attr-${i}-name`); }}
                                                @sl-focus=${() => this._handleFocus(`attr-${i}-name`)}
                                                class=${shouldShowError(`attr-${i}-name`) ? 'has-error' : ''}
                                            ></sl-input>

                                            <sl-input 
                                                autocomplete="off"
                                                placeholder=${isObj ? this.msg("Value") : this.msg("Type")}
                                                style="flex: 1;"
                                                .value=${live(attr.type)}
                                                @sl-input=${(e: FieldEvent) => this._updateAttribute(i, 'type', e.target.value)}
                                                @sl-blur=${() => this._handleBlur(`attr-${i}-type`)}
                                                @sl-focus=${() => this._handleFocus(`attr-${i}-type`)}
                                                class=${shouldShowError(`attr-${i}-type`) ? 'has-error' : ''}
                                            ></sl-input>

                                        </div>
                                        
                                        ${ (shouldShowError(`attr-${i}-name`) || shouldShowError(`attr-${i}-type`) || shouldShowError(`attr-${i}-vis`)) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column;">
                                            ${shouldShowError(`attr-${i}-vis`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon src=${alertTriangleIcon}></sl-icon> ${shouldShowError(`attr-${i}-vis`)?.message}</div>` : ''}
                                            ${shouldShowError(`attr-${i}-name`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon src=${alertTriangleIcon}></sl-icon> ${shouldShowError(`attr-${i}-name`)?.message}</div>` : ''}
                                            ${shouldShowError(`attr-${i}-type`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon src=${alertTriangleIcon}></sl-icon> ${shouldShowError(`attr-${i}-type`)?.message}</div>` : ''}
                                            </div>
                                        ` : '' }
                                        ${shouldShowError(`attr-${i}-modifiers`) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column; border: 1px solid var(--sl-color-danger-500); border-radius: var(--sl-border-radius-small); padding: 4px;">
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <sl-icon src=${alertTriangleIcon}></sl-icon>
                                                    ${shouldShowError(`attr-${i}-modifiers`)?.message}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `)}
                            </div>
                            <sl-button 
                                size="small" 
                                @click=${this._addAttribute}
                            >
                                <sl-icon 
                                    slot="prefix" 
                                    src=${plusIcon}>
                                </sl-icon> 
                                ${this.msg("Add Attribute")}
                            </sl-button>
                        </div>
                    ` : ''}

                    ${isEnum ? html`
                        <div class="dialog-section">
                            <strong style="font-size: var(--sl-font-size-medium);">
                                ${this.msg("Enumeration Values")}
                            </strong>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                ${repeat(this._editingNodeData.enumValues, (_val, i) => `enum-${i}`, (val, i) => html`
                                    <div style="display: flex; gap: 5px; align-items: center;">
                                        <sl-input 
                                            placeholder=${this.msg("Value")}
                                            style="flex: 1;"
                                            .value=${live(val)} 
                                            @sl-input=${(e: FieldEvent) => this._updateEnumValue(i, e.target.value)}
                                        ></sl-input>
                                        <sl-button 
                                            size="small" 
                                            variant="danger" 
                                            outline @click=${() => this._removeEnumValue(i)}
                                            aria-label=${this.msg("Delete Value")}
                                        >
                                            <sl-icon src=${xIcon}></sl-icon>
                                        </sl-button>
                                    </div>
                                `)}
                            </div>
                            <sl-button 
                                size="small" 
                                @click=${this._addEnumValue}
                            >
                                <sl-icon 
                                    slot="prefix" 
                                    src=${plusIcon}>
                                </sl-icon> 
                                ${this.msg("Add Value")}
                            </sl-button>
                        </div>
                    ` : ''}

                    ${showMeths ? html`
                        <div class="dialog-section">
                            <strong style="font-size: var(--sl-font-size-medium);">
                                ${this.msg("Methods")}
                            </strong>
                            <div 
                                id="methods-list" 
                                style="display: flex; flex-direction: column; gap: 10px;"
                            >
                                ${repeat(this._editingNodeData.methods, (_meth, i) => `meth-${i}`, (meth, i) => html`
                                    <div class="method-or-parameter-card">

                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                            
                                            ${showMods ? html`
                                                <div style="display: flex; gap: 8px; align-items: center;">
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${meth.isStatic} 
                                                        @sl-change=${(e: FieldEvent) => this._updateMethod(i, 'isStatic', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            static
                                                        </span>
                                                    </sl-switch>
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${meth.isFinal} 
                                                        @sl-change=${(e: FieldEvent) => this._updateMethod(i, 'isFinal', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            final
                                                        </span>
                                                    </sl-switch>
                                                </div>
                                            ` : html`<div></div>`}

                                            <sl-button 
                                                size="small" 
                                                variant="danger" 
                                                outline 
                                                @click=${() => this._removeMethod(i)}
                                                title=${this.msg("Delete")}
                                                aria-label=${this.msg("Delete")}
                                            >
                                                <sl-icon src=${xIcon}></sl-icon>
                                            </sl-button>

                                        </div>

                                        <div style="display: flex; gap: 5px; align-items: center;">
                                            
                                            ${showVis ? html`
                                                <sl-select 
                                                    .value=${meth.visibility} 
                                                    style="flex: 1;" 
                                                    @sl-blur=${() => this._handleBlur(`meth-${i}-vis`)}
                                                    @sl-focus=${() => this._handleFocus(`meth-${i}-vis`)}
                                                    class=${shouldShowError(`meth-${i}-vis`) ? 'has-error' : ''}
                                                    @sl-change=${(e: FieldEvent) => this._updateMethod(i, 'visibility', e.target.value)}
                                                >
                                                    <sl-option value="public">
                                                        public (+)
                                                    </sl-option>
                                                    ${this.settings.packageExists ? html`
                                                        <sl-option value="package">
                                                            package (~)
                                                        </sl-option>
                                                    ` : ''}           
                                                    <sl-option value="private">
                                                        private (-)
                                                    </sl-option>
                                                    ${this.settings.protectedExists ? html`
                                                        <sl-option value="protected">
                                                            protected (#)
                                                        </sl-option>
                                                    ` : ''}
                                                </sl-select>
                                            ` : ''}
                                            
                                            <sl-input 
                                                autocomplete="off"
                                                placeholder=${this.msg("Name")}
                                                style="flex: 1;" 
                                                .value=${live(meth.name)} 
                                                @sl-input=${(e: FieldEvent) => this._updateMethod(i, 'name', e.target.value)}
                                                @sl-blur=${(e: FieldEvent) => { this._updateMethod(i, 'name', e.target.value.trim()); this._handleBlur(`meth-${i}-name`); }}
                                                @sl-focus=${() => this._handleFocus(`meth-${i}-name`)}
                                                class=${shouldShowError(`meth-${i}-name`) ? 'has-error' : ''}
                                            ></sl-input>
                                            
                                            <sl-input 
                                                autocomplete="off"
                                                placeholder=${this.msg("Return type")}
                                                style="flex: 1;" 
                                                .value=${live(meth.returnType)} 
                                                @sl-input=${(e: FieldEvent) => this._updateMethod(i, 'returnType', e.target.value)}
                                                @sl-blur=${() => this._handleBlur(`meth-${i}-return`)}
                                                @sl-focus=${() => this._handleFocus(`meth-${i}-return`)}
                                                class=${shouldShowError(`meth-${i}-return`) ? 'has-error' : ''}
                                            ></sl-input>
                                        </div>

                                        ${ (shouldShowError(`meth-${i}-name`) || shouldShowError(`meth-${i}-return`) || shouldShowError(`meth-${i}-vis`)) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column;">
                                                ${shouldShowError(`meth-${i}-vis`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon src=${alertTriangleIcon}></sl-icon> ${shouldShowError(`meth-${i}-vis`)?.message}</div>` : ''}
                                                ${shouldShowError(`meth-${i}-name`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon src=${alertTriangleIcon}></sl-icon> ${shouldShowError(`meth-${i}-name`)?.message}</div>` : ''}
                                                ${shouldShowError(`meth-${i}-return`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon src=${alertTriangleIcon}></sl-icon> ${shouldShowError(`meth-${i}-return`)?.message}</div>` : ''}
                                            </div>
                                        ` : '' }
                                        ${shouldShowError(`meth-${i}-modifiers`) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column; border: 1px solid var(--sl-color-danger-500); border-radius: var(--sl-border-radius-small); padding: 4px;">
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <sl-icon src=${alertTriangleIcon}></sl-icon>
                                                    ${shouldShowError(`meth-${i}-modifiers`)?.message}
                                                </div>
                                            </div>
                                        ` : ''}

                                        ${showParams ? html`
                                            <div class="parameter-section" style="display: flex; flex-direction: row; gap: 15px; align-items: flex-start;">
                                                
                                                <div style="font-size: var(--sl-font-size-small); font-weight: bold; color: var(--sl-color-neutral-500); margin-top: 6px; flex-shrink: 0;">
                                                    ${this.msg("Parameters:")}
                                                </div>

                                                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                                                    
                                                    ${meth.parameters.map((p, pi) => html`
                                                        <div style="display: flex; flex-direction: column; width: 100%;">
                                                            
                                                            <div style="display: flex; gap: 5px; align-items: center;">
                                                                
                                                                <sl-input 
                                                                    autocomplete="off"
                                                                    placeholder=${this.msg("Name")}
                                                                    size="small" 
                                                                    style="flex: 1;" 
                                                                    .value=${live(p.name)} 
                                                                    @sl-input=${(e: FieldEvent) => this._updateParameter(i, pi, 'name', e.target.value)}
                                                                    @sl-focus=${() => this._handleFocus(`meth-${i}-param-${pi}-name`)}
                                                                    @sl-blur=${(e: FieldEvent) => { this._updateParameter(i, pi, 'name', e.target.value.trim()); this._handleBlur(`meth-${i}-param-${pi}-name`); }}
                                                                    class=${shouldShowError(`meth-${i}-param-${pi}-name`) ? 'has-error' : ''}
                                                                ></sl-input>

                                                                <sl-input 
                                                                    autocomplete="off"
                                                                    placeholder=${this.msg("Type")}
                                                                    size="small" 
                                                                    style="flex: 1;" 
                                                                    .value=${live(p.type)} 
                                                                    @sl-input=${(e: FieldEvent) => this._updateParameter(i, pi, 'type', e.target.value)}
                                                                    @sl-blur=${() => this._handleBlur(`meth-${i}-param-${pi}-type`)}
                                                                    @sl-focus=${() => this._handleFocus(`meth-${i}-param-${pi}-type`)}
                                                                    class=${shouldShowError(`meth-${i}-param-${pi}-type`) ? 'has-error' : ''}
                                                                ></sl-input>

                                                                <sl-button 
                                                                    size="small" 
                                                                    variant="danger" 
                                                                    outline 
                                                                    @click=${() => this._removeParameter(i, pi)}
                                                                    title=${this.msg("Delete Parameter")}
                                                                    aria-label=${this.msg("Delete Parameter")}
                                                                >
                                                                    <sl-icon src=${xIcon}></sl-icon>
                                                                </sl-button>
                                                            </div>

                                                            ${ (shouldShowError(`meth-${i}-param-${pi}-name`) || shouldShowError(`meth-${i}-param-${pi}-type`)) ? html`
                                                                <div style="color: var(--sl-color-danger-600); font-size: 0.7em; margin-top: 2px; display: flex; flex-direction: column;">
                                                                    ${shouldShowError(`meth-${i}-param-${pi}-name`) ? html`
                                                                        <div style="display: flex; align-items: center; gap: 4px;">
                                                                            <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                                                            ${shouldShowError(`meth-${i}-param-${pi}-name`)?.message}
                                                                        </div>
                                                                    ` : ''}
                                                                    ${shouldShowError(`meth-${i}-param-${pi}-type`) ? html`
                                                                        <div style="display: flex; align-items: center; gap: 4px;">
                                                                            <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                                                            ${shouldShowError(`meth-${i}-param-${pi}-type`)?.message}
                                                                        </div>
                                                                    ` : ''}
                                                                </div>
                                                            ` : '' }
                                                        </div>
                                                    `)}

                                                    <sl-button 
                                                        size="small" 
                                                        @click=${() => this._addParameter(i)} 
                                                        style="width: 100%;"
                                                    >
                                                        <sl-icon slot="prefix" src=${plusIcon}></sl-icon> ${this.msg("Add Parameter")}
                                                    </sl-button>

                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `)}
                            </div>
                            <sl-button 
                                size="small" 
                                @click=${this._addMethod}
                            >
                                <sl-icon 
                                    slot="prefix" 
                                    src=${plusIcon}>
                                </sl-icon> 
                                ${this.msg("Add Method")}
                            </sl-button>
                        </div>
                    ` : ''}
                </div>

                <div 
                    slot="footer" 
                    class="footer-container"
                >
                    <sl-button 
                        variant="danger" 
                        outline 
                        @click=${this._delete}
                    >
                        <sl-icon 
                            slot="prefix" 
                            src=${trashIcon}>
                        </sl-icon>
                        ${this.msg("Delete")}
                    </sl-button>

                    <sl-button 
                        variant="primary" 
                        @click=${this._save}
                    >
                        ${this.msg("Save")}
                    </sl-button>
                </div>
            </sl-dialog>
        `;
    }
}