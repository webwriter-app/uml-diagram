import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { query, state, property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { ClassModel, ClassAttribute, ClassMethod } from "../../models/class-model";
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import { ClassSettings } from "../../models/class-settings-model";
import { SlButton, SlDialog, SlInput, SlRadio, SlOption, SlSelect, SlIcon, SlSwitch, SlPopup } from "@shoelace-style/shoelace";
import styles from "./class-dialog.styles";
import xIcon from "@tabler/icons/outline/x.svg";
import plusIcon from "@tabler/icons/outline/plus.svg";
import trashIcon from "@tabler/icons/outline/trash.svg";
import { GlobalSettings } from "../../../global-settings/global-settings-model";

/** Interface definition for single validation issues */
interface ValidationIssue {
    target: string;                
    message: string;               
    settingKey: keyof ClassSettings; 
}

/** Interface to check if relation rules are broken */
export interface RelationConstraint {
    type: string;                   
    direction: 'source' | 'target'; 
    otherNodeType: string;          
}

/** Defines a dialog for editing classes/objects */
@localized()
export class ClassDialog extends LitElementWw{

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
    @query("#edit-dialog") accessor dialog!: any;

    /** stores the Id of the node that is edited */
    @state() private _selectedNodeId: string | null = null;

    /** Stores fields that were already touched to show validation errors if active */
    @state() private _touchedFields = new Set<string>();

    /** Gets activated to show all Errors if still existent when trying to save */
    @state() private _showAllErrors = false;

    /** List of already existing Names for validating new names (to don't use a name twice) */
    @state() private _existingNames: string[] = [];

    /** Stores relations of the class to check if validation rules are broken (if active) */
    @state() private _constraints: RelationConstraint[] = [];

    /** Property to store the passed down class- or object- settings */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Property to store the passed down diagram type */
    @property({ type: String }) accessor diagramType: string = 'class-diagram';

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** Inital Data for the dialog to make it always active (otherwise it doesn't open the first time) */
    @state() private _editingNodeData: ClassModel = {
        type: 'standard',
        name: '',
        attributes: [],
        methods: [],
        objectName: '',
        enumValues: [],
        associatedConnectionId: ''
    }; 

    /** state to store the currently focused field to stop validation-text from beeing displayed */
    @state() private _focusedField: string | null = null;

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
    private _save() {
        if (!this._selectedNodeId || !this._editingNodeData) return;
        // Checks for validation errors and stop the process if there are some
        const activeIssues = this._activeIssues;
        if (activeIssues.length > 0) {
            this._showAllErrors = true;
            this.requestUpdate();
            const msgList = activeIssues.map(i => `- ${i.message}`).join('\n');
            alert(msg("Please fix the following issues before saving:") + "\n\n" + msgList);
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
        // confirm message because unwanted click could delete a lot of data for big classes with many relations
        if (!confirm(msg("Do you really want to delete this element?"))) return;

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

    /** Add empty new attribute */
    private _addAttribute() {
        if (!this._editingNodeData) return;
        
        const newAttr: ClassAttribute = { 
            visibility: 'public', 
            name: '', 
            type: '', 
            isStatic: false,
            isFinal: false,
            isParam: false
        };
        
        this._editingNodeData = {
            ...this._editingNodeData,
            attributes: [...this._editingNodeData.attributes, newAttr]
        };
        
        this.requestUpdate();
    }

    /** Update the content of a given attribute */
    private _updateAttribute(index: number, field: keyof ClassAttribute, value: string) {
        if (!this._editingNodeData) return;

        const newAttributes = [...this._editingNodeData.attributes];

        newAttributes[index] = { 
            ...newAttributes[index], 
            [field]: value 
        } as ClassAttribute;

        this._editingNodeData = {
            ...this._editingNodeData,
            attributes: newAttributes
        };

        this.requestUpdate();
    }

    /** Delete the selected attribute from the class */
    private _removeAttribute(index: number) {
        if (!this._editingNodeData) return;
        
        const newAttributes = [...this._editingNodeData.attributes];
        newAttributes.splice(index, 1);

        this._editingNodeData = {
            ...this._editingNodeData,
            attributes: newAttributes
        };

        this.requestUpdate();
    }

    /** Add empty new method */
    private _addMethod() {
        if (!this._editingNodeData) return;
        
        const newMethods: ClassMethod = { 
            visibility: 'public', 
            name: '', 
            returnType: '', 
            parameters: [],
            isStatic: false,
            isFinal: false
        };
        
        this._editingNodeData = {
            ...this._editingNodeData,
            methods: [...this._editingNodeData.methods, newMethods]
        };
        
        this.requestUpdate();
    }

    /** Update the content of a given method */
    private _updateMethod(index: number, field: keyof ClassMethod, value: string) {
        if (!this._editingNodeData) return;
        
        const newMethods = [...this._editingNodeData.methods];
        
        newMethods[index] = { 
            ...newMethods[index], 
            [field]: value 
        } as ClassMethod;

        this._editingNodeData = {
            ...this._editingNodeData,
            methods: newMethods
        };

        this.requestUpdate();
    }

    /** Delete the selected method from the class */
    private _removeMethod(index: number) {
        if (!this._editingNodeData) return;
        
        const newMethods = [...this._editingNodeData.methods];
        newMethods.splice(index, 1);

        this._editingNodeData = {
            ...this._editingNodeData,
            methods: newMethods
        };

        this.requestUpdate();
    }

    /** Add empty new parameter to the method */
    private _addParameter(methodIndex: number) {
        if (!this._editingNodeData) return;
        const newMethods = [...this._editingNodeData.methods];
        const targetMethod = { ...newMethods[methodIndex] };

        targetMethod.parameters = [
            ...targetMethod.parameters, 
            { name: '', type: '' }
        ];
        
        newMethods[methodIndex] = targetMethod;
        this._editingNodeData = { ...this._editingNodeData, methods: newMethods };
        this.requestUpdate();
    }

    /** Update the content of a given parameter */
    private _updateParameter(methodIndex: number, paramIndex: number, field: 'name' | 'type', value: string) {
        if (!this._editingNodeData) return;
        
        const newMethods = [...this._editingNodeData.methods];
        const targetMethod = { ...newMethods[methodIndex] };
        const newParams = [...targetMethod.parameters];
        
        newParams[paramIndex] = { ...newParams[paramIndex], [field]: value };
        targetMethod.parameters = newParams;
        newMethods[methodIndex] = targetMethod;
        
        this._editingNodeData = { ...this._editingNodeData, methods: newMethods };
        this.requestUpdate();
    }

    /** Delete the selected parameter from the method */
    private _removeParameter(methodIndex: number, paramIndex: number) {
        if (!this._editingNodeData) return;

        const newMethods = [...this._editingNodeData.methods];
        const targetMethod = { ...newMethods[methodIndex] };
        const newParams = [...targetMethod.parameters];
        newParams.splice(paramIndex, 1);
        targetMethod.parameters = newParams;
        newMethods[methodIndex] = targetMethod;
        
        this._editingNodeData = {
            ...this._editingNodeData,
            methods: newMethods
        };

        this.requestUpdate();
    }

    /** Add an empty enum value */
    private _addEnumValue() {
        if (!this._editingNodeData) return;
        const newValues = [...(this._editingNodeData.enumValues || [])];
        newValues.push("");
        this._editingNodeData = { ...this._editingNodeData, enumValues: newValues };
        this.requestUpdate();
    }

    /** Updates an emum value for a given index */
    private _updateEnumValue(index: number, value: string) {
        if (!this._editingNodeData) return;
        const newValues = [...this._editingNodeData.enumValues];
        newValues[index] = value;
        this._editingNodeData = { ...this._editingNodeData, enumValues: newValues };
        this.requestUpdate();
    }

    /** Delete an enum value with a given index */
    private _removeEnumValue(index: number) {
        if (!this._editingNodeData) return;
        const newValues = [...this._editingNodeData.enumValues];
        newValues.splice(index, 1);
        this._editingNodeData = { ...this._editingNodeData, enumValues: newValues };
        this.requestUpdate();
    }

    /** Change the name of the class */
    private _handleNameChange(e: any) {
        if (!this._editingNodeData) return;
        
        this._editingNodeData = {
            ...this._editingNodeData,
            name: e.target.value
        };
        this.requestUpdate();
    }

    /** Change the type of the class */
    private _handleTypeChange(e: any) {
        if (!this._editingNodeData) return;
        
        this._editingNodeData = {
            ...this._editingNodeData,
            type: e.target.value
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
        if (!this._editingNodeData) return [];
        const d = this._editingNodeData;
        const issues: ValidationIssue[] = [];
        const isObject = d.type === 'object';

        // helper to check if a method name matches the class name (= constructor)
        const isConstructor = (methName: string) => methName.trim() === d.name.trim();
        
        // helper to check if a method name looks like a constructor (case-insensitive match)
        const looksLikeConstructor = (methName: string) => 
            methName.trim().toLowerCase() === d.name.trim().toLowerCase() && methName.trim() !== d.name.trim();

        // checkEmptyObjectNames
        if (isObject && (!d.objectName || d.objectName.trim() === '')) {
            issues.push({
                target: 'objectname',
                message: msg('Object name is required.'),
                settingKey: 'checkEmptyObjectNames'
            });
        }

        // checkEmptyClassNames
        if (!d.name || d.name.trim() === '') {
            issues.push({
                target: 'classname',
                message: msg('Class name is required.'),
                settingKey: 'checkEmptyClassNames'
            });
        }

        // checkUniqueNames (class name)
        if (d.name && d.name.trim() !== '' && this._existingNames.includes(d.name)) {
            issues.push({
                target: 'classname',
                message: msg('This name is already used by another class.'),
                settingKey: 'checkUniqueNames'
            });
        }

        // checkNamingConventions (object name)
        if (isObject && d.objectName && /^[A-Z]/.test(d.objectName.trim())) {
            issues.push({
                target: 'objectname',
                message: msg('Object names should start with a lowercase letter.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // checkNamingConventions: check for space in object names
        if (isObject && d.objectName && /\s/.test(d.objectName.trim())) {
            issues.push({
                target: 'objectname',
                message: msg('Object names must not contain spaces.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // checkNamingConventions (class name)
        if (d.name && /^[a-z]/.test(d.name.trim())) {
            issues.push({
                target: 'classname',
                message: msg('Class names should start with an uppercase letter.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // checkNamingConventions: check for space in class name
        if (d.name && /\s/.test(d.name.trim())) {
            issues.push({
                target: 'classname',
                message: msg('Class names must not contain spaces.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // Attributes
        d.attributes.forEach((attr, index) => {

            // checkEmptyAttrMethParamFields: empty name
            if (!attr.name || attr.name.trim() === '') {
                issues.push({
                    target: `attr-${index}-name`,
                    message: msg('Attribute name is required.'),
                    settingKey: 'checkEmptyAttrMethParamFields'
                });
            }

            // checkEmptyAttrMethParamFields: empty type
            if (!attr.type || attr.type.trim() === '') {
                issues.push({
                    target: `attr-${index}-type`,
                    message: msg('Attribute type is required.'),
                    settingKey: 'checkEmptyAttrMethParamFields'
                });
            }

            // checkUniqueNames: duplicate attribute name within the same class
            const duplicate = d.attributes.find((a, i) => i !== index && a.name === attr.name && attr.name.trim() !== '');
            if (duplicate) {
                issues.push({
                    target: `attr-${index}-name`,
                    message: msg('Duplicate attribute name.'),
                    settingKey: 'checkUniqueNames'
                });
            }

            // checkNamingConventions: attribute name should start with lowercase
            if (attr.name && /^[A-Z]/.test(attr.name.trim())) {
                issues.push({
                    target: `attr-${index}-name`,
                    message: msg('Attribute names should start with a lowercase letter.'),
                    settingKey: 'checkNamingConventions'
                });
            }

            // checkNamingConventions: check for space in attribute name
            if (attr.name && /\s/.test(attr.name.trim())) {
                issues.push({
                    target: `attr-${index}-name`,
                    message: msg('Attribute names must not contain spaces.'),
                    settingKey: 'checkNamingConventions'
                });
            }

            // checkModifiers: visibility in interfaces and annotations must be public
            if ((d.type === 'interface' || d.type === 'annotation') && (attr.visibility === 'private' || attr.visibility === 'protected' || attr.visibility === 'package')) {
                issues.push({
                    target: `attr-${index}-vis`,
                    message: msg('Attributes in interfaces and annotations must be public.'),
                    settingKey: 'checkModifiers'
                });
            }

            // checkModifiers: interface attributes must be static and final
            if (d.type === 'interface' && (!attr.isStatic || !attr.isFinal)) {
                issues.push({
                    target: `attr-${index}-modifiers`,
                    message: msg('Interface attributes must be static and final.'),
                    settingKey: 'checkModifiers'
                });
            }

            // checkModifiers: isParam only valid in parameterized classes
            if (attr.isParam && d.type !== 'param-class') {
                issues.push({
                    target: `attr-${index}-modifiers`,
                    message: msg('Parameter attributes are only valid in parameterized classes.'),
                    settingKey: 'checkModifiers'
                });
            }
        });

        // Methods
        d.methods.forEach((meth, index) => {
            const isConstr = isConstructor(meth.name);

            // checkEmptyAttrMethParamFields: empty method name
            if (!meth.name || meth.name.trim() === '') {
                issues.push({
                    target: `meth-${index}-name`,
                    message: msg('Method name is required.'),
                    settingKey: 'checkEmptyAttrMethParamFields'
                });
            }

            // checkEmptyAttrMethParamFields: empty return type for non constructor
            if (!isConstr && (!meth.returnType || meth.returnType.trim() === '')) {
                issues.push({
                    target: `meth-${index}-return`,
                    message: msg('Return type is required.'),
                    settingKey: 'checkEmptyAttrMethParamFields'
                });
            }

            // checkConstructorReturnType: constructor must not have a return type
            if (isConstr && meth.returnType && meth.returnType.trim() !== '') {
                issues.push({
                    target: `meth-${index}-return`,
                    message: msg('Constructors must not have a return type.'),
                    settingKey: 'checkConstructorReturnType'
                });
            }

            // checkNoConstructorsInObjects: objects cannot have constructors
            if (isObject && isConstr) {
                issues.push({
                    target: `meth-${index}-name`,
                    message: msg('Objects do not have constructors.'),
                    settingKey: 'checkNoConstructorsInObjects'
                });
            }

            // checkNamingConventions: method naming
            if (meth.name && meth.name.trim() !== '') {
                if (looksLikeConstructor(meth.name)) {
                    // looks like a constructor but written with wrong capitalization
                    issues.push({
                        target: `meth-${index}-name`,
                        message: msg('This looks like a constructor but does not match the class name capitalization.'),
                        settingKey: 'checkNamingConventions'
                    });
                } else if (!isConstr && /^[A-Z]/.test(meth.name.trim())) {
                    // regular method starting with uppercase
                    issues.push({
                        target: `meth-${index}-name`,
                        message: msg('Method names should start with a lowercase letter.'),
                        settingKey: 'checkNamingConventions'
                    });
                }
            }

            // checkNamingConventions: check for space in method names
            if (meth.name && /\s/.test(meth.name.trim())) {
                issues.push({
                    target: `meth-${index}-name`,
                    message: msg('Method names must not contain spaces.'),
                    settingKey: 'checkNamingConventions'
                });
            }

            // checkModifiers: visibility in interfaces and annotations must be public
            if ((d.type === 'interface' || d.type === 'annotation') && (meth.visibility === 'private' || meth.visibility === 'protected' || meth.visibility === 'package')) {
                issues.push({
                    target: `meth-${index}-vis`,
                    message: msg('Methods in interfaces and annotations must be public.'),
                    settingKey: 'checkModifiers'
                });
            }

            // checkModifiers: abstract methods cannot be final
            if (d.type === 'abstract' && meth.isFinal) {
                issues.push({
                    target: `meth-${index}-modifiers`,
                    message: msg('Abstract methods cannot be final.'),
                    settingKey: 'checkModifiers'
                });
            }

            // checkModifiers: abstract methods cannot be static
            if (d.type === 'abstract' && meth.isStatic) {
                issues.push({
                    target: `meth-${index}-modifiers`,
                    message: msg('Abstract methods cannot be static.'),
                    settingKey: 'checkModifiers'
                });
            }

            // checkModifiers: constructors cannot be static or final
            if (isConstr && (meth.isStatic || meth.isFinal)) {
                issues.push({
                    target: `meth-${index}-modifiers`,
                    message: msg('Constructors cannot be static or final.'),
                    settingKey: 'checkModifiers'
                });
            }

            // Parameters
            meth.parameters.forEach((param, pIndex) => {

                // checkEmptyAttrMethParamFields: empty parameter name
                if (!param.name || param.name.trim() === '') {
                    issues.push({
                        target: `meth-${index}-param-${pIndex}-name`,
                        message: msg('Parameter name is required.'),
                        settingKey: 'checkEmptyAttrMethParamFields'
                    });
                }

                // checkEmptyAttrMethParamFields: empty parameter type
                if (!param.type || param.type.trim() === '') {
                    issues.push({
                        target: `meth-${index}-param-${pIndex}-type`,
                        message: msg('Parameter type is required.'),
                        settingKey: 'checkEmptyAttrMethParamFields'
                    });
                }

                // checkUniqueNames: duplicate parameter name within the same method
                const dupParam = meth.parameters.find((p, pi) => pi !== pIndex && p.name === param.name && param.name.trim() !== '');
                if (dupParam) {
                    issues.push({
                        target: `meth-${index}-param-${pIndex}-name`,
                        message: msg('Duplicate parameter name.'),
                        settingKey: 'checkUniqueNames'
                    });
                }

                // checkNamingConventions: parameter name should start with lowercase
                if (param.name && /^[A-Z]/.test(param.name.trim())) {
                    issues.push({
                        target: `meth-${index}-param-${pIndex}-name`,
                        message: msg('Parameter names should start with a lowercase letter.'),
                        settingKey: 'checkNamingConventions'
                    });
                }

                // checkNamingConventions: check for space in parameter name
                if (param.name && /\s/.test(param.name.trim())) {
                    issues.push({
                        target: `meth-${index}-param-${pIndex}-name`,
                        message: msg('Parameter names must not contain spaces.'),
                        settingKey: 'checkNamingConventions'
                    });
                }
            });
        });

        // checkClassConnections
        if (this._constraints && this._constraints.length > 0) {
            for (const c of this._constraints) {

                // inheritance rules
                if (c.type === 'inheritance') {
                    if (c.direction === 'source') {
                        if (d.type === 'enum' || d.type === 'record') {
                            issues.push({ target: 'classtype', message: msg("Selected class type cannot extend other classes."), settingKey: 'checkClassConnections' });
                        }
                        if (d.type === 'interface' && c.otherNodeType !== 'interface') {
                            issues.push({ target: 'classtype', message: msg("Selected class type can only extend other interfaces."), settingKey: 'checkClassConnections' });
                        }
                        if (d.type !== 'interface' && c.otherNodeType === 'interface') {
                            issues.push({ target: 'classtype', message: msg("Selected class type cannot extend an interface. Use Realization instead."), settingKey: 'checkClassConnections' });
                        }
                        if (d.type === 'annotation') {
                            issues.push({ target: 'classtype', message: msg("Selected class type cannot extend other classes."), settingKey: 'checkClassConnections' });
                        }
                    }
                    if (c.direction === 'target') {
                        if (d.type === 'interface' && c.otherNodeType !== 'interface') {
                            issues.push({ target: 'classtype', message: msg("Selected class type cannot be extended by a class. Use Realization instead."), settingKey: 'checkClassConnections' });
                        }
                        if (d.type !== 'interface' && c.otherNodeType === 'interface') {
                            issues.push({ target: 'classtype', message: msg("Selected class type can only be extended by other interfaces."), settingKey: 'checkClassConnections' });
                        }
                        if (d.type === 'enum' || d.type === 'record') {
                            issues.push({ target: 'classtype', message: msg("Selected class type cannot be a parent class."), settingKey: 'checkClassConnections' });
                        }
                        if (d.type === 'annotation') {
                            issues.push({ target: 'classtype', message: msg("Selected class type cannot be a parent class."), settingKey: 'checkClassConnections' });
                        }
                    }
                }

                // realization rules
                if (c.type === 'realization') {
                    if (c.direction === 'source' && (d.type === 'interface' || d.type === 'annotation')) {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot implement interfaces. Use Inheritance instead."), settingKey: 'checkClassConnections' });
                    }
                    if (c.direction === 'target' && d.type !== 'interface') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot be a realization target. Only interfaces are valid targets."), settingKey: 'checkClassConnections' });
                    }
                }

                // composition and aggregation rules
                if (c.type === 'composition' || c.type === 'aggregation') {
                    const invalidSourceTypes = ['interface', 'enum', 'datatype', 'annotation'];
                    const invalidTargetTypes = ['enum', 'datatype', 'annotation'];
                    if (c.direction === 'source' && invalidSourceTypes.includes(d.type)) {
                        issues.push({
                            target: 'classtype',
                            message: msg("Selected class type cannot own compositions or aggregations."),
                            settingKey: 'checkClassConnections'
                        });
                    }
                    if (c.direction === 'target' && invalidTargetTypes.includes(d.type)) {
                        issues.push({
                            target: 'classtype',
                            message: msg("Selected class type cannot be part of a composition or aggregation."),
                            settingKey: 'checkClassConnections'
                        });
                    }
                }

                // bidirectional association rules
                if (c.type === 'association-bidirectional') {
                    if (d.type === 'datatype' || d.type === 'enum') {
                        issues.push({
                            target: 'classtype',
                            message: msg("Selected class type cannot participate in bidirectional associations."),
                            settingKey: 'checkClassConnections'
                        });
                    }
                }

                // one directional association rules
                if (c.type === 'association' && c.direction === 'source') {
                    if (d.type === 'datatype' || d.type === 'enum') {
                        issues.push({
                            target: 'classtype',
                            message: msg("Selected class type cannot be the source of an association."),
                            settingKey: 'checkClassConnections'
                        });
                    }
                }

                // object rules (objects can only participate in associations, compositionsx aggregations and dependancys)
                if (d.type === 'object') {
                    const invalidForObjects = ['inheritance', 'realization'];
                    if (invalidForObjects.includes(c.type)) {
                        if (c.direction === 'source') {
                            issues.push({
                                target: 'classtype',
                                message: msg("Objects cannot be the source of inheritance or realization relations."),
                                settingKey: 'checkClassConnections'
                            });
                        }
                        if (c.direction === 'target') {
                            issues.push({
                                target: 'classtype',
                                message: msg("Objects cannot be the target of inheritance or realization relations."),
                                settingKey: 'checkClassConnections'
                            });
                        }
                    }
                }
            }
        }

        return issues;
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
                ${isObjectDiagram ? msg("Object Editor") : msg("Class Editor")}
            </span>

                <div style="display: flex; flex-direction: column; gap: var(--sl-spacing-medium);">
                    
                    <div style="display: flex; gap: var(--sl-spacing-medium); align-items: flex-start;">
                        
                        ${isObj ? html`
                            <div style="flex: 1;">
                                <sl-input 
                                    id="edit-object-name"
                                    class=${shouldShowError('objectname') ? 'has-error' : ''}
                                    .value=${live(this._editingNodeData.objectName || '')}
                                    @sl-input=${(e: any) => {
                                        this._editingNodeData = { ...this._editingNodeData, objectName: e.target.value };
                                        this.requestUpdate();
                                    }}
                                    @sl-blur=${(e: any) => { this._editingNodeData = { ...this._editingNodeData, objectName: e.target.value.trim() }; this._handleBlur('objectname'); }}
                                    @sl-focus=${() => this._handleFocus(`objectname`)}
                                >
                                    <span slot="label">
                                        ${msg("Instance Name")}
                                    </span>
                                </sl-input>

                                ${shouldShowError('objectname') ? html`
                                    <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                        <sl-icon name="exclamation-triangle" style="font-size: 1em;"></sl-icon> 
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
                                @sl-blur=${(e: any) => { this._editingNodeData = { ...this._editingNodeData, name: e.target.value.trim() }; this._handleBlur('classname'); }}
                                @sl-focus=${() => this._handleFocus(`classname`)}
                                class=${shouldShowError('classname') ? 'has-error' : ''}
                            >
                                <span slot="label">
                                    ${isObj ? msg("Class Name") : msg("Name")}
                                </span>
                            </sl-input>
                            
                            ${shouldShowError('classname') ? html`
                                <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                    <sl-icon name="exclamation-triangle" style="font-size: 1em;"></sl-icon> 
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
                                        ${msg("Type")}
                                    </span>
                                    ${this.settings.standardExists ? html`<sl-option value="standard">${msg("Standard")}</sl-option>` : ''}
                                    ${this.settings.abstractExists ? html`<sl-option value="abstract">${msg("Abstract")}</sl-option>` : ''}
                                    ${this.settings.interfaceExists ? html`<sl-option value="interface">${msg("Interface")}</sl-option>` : ''}
                                    ${this.settings.enumExists ? html`<sl-option value="enum">${msg("Enumeration")}</sl-option>` : ''}
                                    ${this.settings.objectExists ? html`<sl-option value="object">${msg("Object")}</sl-option>` : ''}
                                    ${this.settings.parameterizedExists ? html`<sl-option value="param-class">${msg("Parameterized")}</sl-option>` : ''}
                                    ${this.settings.recordExists ? html`<sl-option value="record">${msg("Record")}</sl-option>` : ''}
                                    ${this.settings.annotationExists ? html`<sl-option value="annotation">${msg("Annotation")}</sl-option>` : ''}
                                    ${this.settings.dataTypeExists ? html`<sl-option value="datatype">${msg("DataType")}</sl-option>` : ''}
                                </sl-select>

                                ${shouldShowError('classtype') ? html`
                                    <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                        <sl-icon 
                                            name="exclamation-triangle" 
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
                                ${msg("Attributes")}
                            </strong>
                            <div 
                                id="attributes-list" 
                                style="display: flex; flex-direction: column; gap: 5px;"
                            >
                                ${repeat(this._editingNodeData.attributes, (attr, i) => `attr-${i}`, (attr, i) => html`
                                    <div class="method-or-parameter-card">

                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                            
                                            ${showMods ? html`
                                                <div style="display: flex; gap: 8px; align-items: center;">
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${attr.isStatic} 
                                                        @sl-change=${(e: any) => this._updateAttribute(i, 'isStatic', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            ${msg("static")}
                                                        </span>
                                                    </sl-switch>
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${attr.isFinal} 
                                                        @sl-change=${(e: any) => this._updateAttribute(i, 'isFinal', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            ${msg("final")}
                                                        </span>
                                                    </sl-switch>
                                                    ${this._editingNodeData.type === 'param-class' ? html`
                                                        <sl-switch 
                                                            size="small" 
                                                            .checked=${attr.isParam} 
                                                            @sl-change=${(e: any) => this._updateAttribute(i, 'isParam', e.target.checked)}
                                                        >
                                                            <span style="font-size: var(--sl-font-size-medium);">
                                                                ${msg("parameterized")}
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
                                                title=${msg("Delete")}
                                            >
                                                <sl-icon src=${xIcon}></sl-icon>
                                            </sl-button>
                                        </div>

                                        <div style="display: flex; gap: 5px; align-items: center;">
                                            
                                            ${showVis ? html`
                                                <sl-select 
                                                    .value=${attr.visibility} 
                                                    style="flex: 1;" 
                                                    @sl-change=${(e: any) => this._updateAttribute(i, 'visibility', e.target.value)}
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
                                                placeholder="name" 
                                                style="flex: 1;"
                                                .value=${live(attr.name)} 
                                                @sl-input=${(e: any) => this._updateAttribute(i, 'name', e.target.value)}
                                                @sl-blur=${(e: any) => { this._updateAttribute(i, 'name', e.target.value.trim()); this._handleBlur(`attr-${i}-name`); }}
                                                @sl-focus=${() => this._handleFocus(`attr-${i}-name`)}
                                                class=${shouldShowError(`attr-${i}-name`) ? 'has-error' : ''}
                                            ></sl-input>

                                            <sl-input 
                                                autocomplete="off"
                                                placeholder=${isObj ? "value" : "type"} 
                                                style="flex: 1;"
                                                .value=${live(attr.type)}
                                                @sl-input=${(e: any) => this._updateAttribute(i, 'type', e.target.value)}
                                                @sl-blur=${() => this._handleBlur(`attr-${i}-type`)}
                                                @sl-focus=${() => this._handleFocus(`attr-${i}-type`)}
                                                class=${shouldShowError(`attr-${i}-type`) ? 'has-error' : ''}
                                            ></sl-input>

                                        </div>
                                        
                                        ${ (shouldShowError(`attr-${i}-name`) || shouldShowError(`attr-${i}-type`) || shouldShowError(`attr-${i}-vis`)) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column;">
                                            ${shouldShowError(`attr-${i}-vis`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon name="exclamation-triangle"></sl-icon> ${shouldShowError(`attr-${i}-vis`)?.message}</div>` : ''}
                                            ${shouldShowError(`attr-${i}-name`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon name="exclamation-triangle"></sl-icon> ${shouldShowError(`attr-${i}-name`)?.message}</div>` : ''}
                                            ${shouldShowError(`attr-${i}-type`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon name="exclamation-triangle"></sl-icon> ${shouldShowError(`attr-${i}-type`)?.message}</div>` : ''}
                                            </div>
                                        ` : '' }
                                        ${shouldShowError(`attr-${i}-modifiers`) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column; border: 1px solid var(--sl-color-danger-500); border-radius: var(--sl-border-radius-small); padding: 4px;">
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <sl-icon name="exclamation-triangle"></sl-icon>
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
                                ${msg("Add Attribute")}
                            </sl-button>
                        </div>
                    ` : ''}

                    ${isEnum ? html`
                        <div class="dialog-section">
                            <strong style="font-size: var(--sl-font-size-medium);">
                                ${msg("Enumeration Values")}
                            </strong>
                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                ${repeat(this._editingNodeData.enumValues, (val, i) => `enum-${i}`, (val, i) => html`
                                    <div style="display: flex; gap: 5px; align-items: center;">
                                        <sl-input 
                                            placeholder="Value" 
                                            style="flex: 1;"
                                            .value=${live(val)} 
                                            @sl-input=${(e: any) => this._updateEnumValue(i, e.target.value)}
                                        ></sl-input>
                                        <sl-button 
                                            size="small" 
                                            variant="danger" 
                                            outline @click=${() => this._removeEnumValue(i)}
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
                                ${msg("Add Value")}
                            </sl-button>
                        </div>
                    ` : ''}

                    ${showMeths ? html`
                        <div class="dialog-section">
                            <strong style="font-size: var(--sl-font-size-medium);">
                                ${msg("Methods")}
                            </strong>
                            <div 
                                id="methods-list" 
                                style="display: flex; flex-direction: column; gap: 10px;"
                            >
                                ${repeat(this._editingNodeData.methods, (meth, i) => `meth-${i}`, (meth, i) => html`
                                    <div class="method-or-parameter-card">

                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                            
                                            ${showMods ? html`
                                                <div style="display: flex; gap: 8px; align-items: center;">
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${meth.isStatic} 
                                                        @sl-change=${(e: any) => this._updateMethod(i, 'isStatic', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            ${msg("static")}
                                                        </span>
                                                    </sl-switch>
                                                    <sl-switch 
                                                        size="small" 
                                                        .checked=${meth.isFinal} 
                                                        @sl-change=${(e: any) => this._updateMethod(i, 'isFinal', e.target.checked)}
                                                    >
                                                        <span style="font-size: var(--sl-font-size-medium);">
                                                            ${msg("final")}
                                                        </span>
                                                    </sl-switch>
                                                </div>
                                            ` : html`<div></div>`}

                                            <sl-button 
                                                size="small" 
                                                variant="danger" 
                                                outline 
                                                @click=${() => this._removeMethod(i)}
                                                title=${msg("Delete")}
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
                                                    @sl-change=${(e: any) => this._updateMethod(i, 'visibility', e.target.value)}
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
                                                placeholder="name" 
                                                style="flex: 1;" 
                                                .value=${live(meth.name)} 
                                                @sl-input=${(e: any) => this._updateMethod(i, 'name', e.target.value)}
                                                @sl-blur=${(e: any) => { this._updateMethod(i, 'name', e.target.value.trim()); this._handleBlur(`meth-${i}-name`); }}
                                                @sl-focus=${() => this._handleFocus(`meth-${i}-name`)}
                                                class=${shouldShowError(`meth-${i}-name`) ? 'has-error' : ''}
                                            ></sl-input>
                                            
                                            <sl-input 
                                                autocomplete="off"
                                                placeholder="return type" 
                                                style="flex: 1;" 
                                                .value=${live(meth.returnType)} 
                                                @sl-input=${(e: any) => this._updateMethod(i, 'returnType', e.target.value)}
                                                @sl-blur=${() => this._handleBlur(`meth-${i}-return`)}
                                                @sl-focus=${() => this._handleFocus(`meth-${i}-return`)}
                                                class=${shouldShowError(`meth-${i}-return`) ? 'has-error' : ''}
                                            ></sl-input>
                                        </div>

                                        ${ (shouldShowError(`meth-${i}-name`) || shouldShowError(`meth-${i}-return`) || shouldShowError(`meth-${i}-vis`)) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column;">
                                                ${shouldShowError(`meth-${i}-vis`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon name="exclamation-triangle"></sl-icon> ${shouldShowError(`meth-${i}-vis`)?.message}</div>` : ''}
                                                ${shouldShowError(`meth-${i}-name`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon name="exclamation-triangle"></sl-icon> ${shouldShowError(`meth-${i}-name`)?.message}</div>` : ''}
                                                ${shouldShowError(`meth-${i}-return`) ? html`<div style="display: flex; align-items: center; gap: 4px;"><sl-icon name="exclamation-triangle"></sl-icon> ${shouldShowError(`meth-${i}-return`)?.message}</div>` : ''}
                                            </div>
                                        ` : '' }
                                        ${shouldShowError(`meth-${i}-modifiers`) ? html`
                                            <div style="color: var(--sl-color-danger-600); font-size: 0.8em; margin-top: 2px; display: flex; flex-direction: column; border: 1px solid var(--sl-color-danger-500); border-radius: var(--sl-border-radius-small); padding: 4px;">
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <sl-icon name="exclamation-triangle"></sl-icon>
                                                    ${shouldShowError(`meth-${i}-modifiers`)?.message}
                                                </div>
                                            </div>
                                        ` : ''}

                                        ${showParams ? html`
                                            <div class="parameter-section" style="display: flex; flex-direction: row; gap: 15px; align-items: flex-start;">
                                                
                                                <div style="font-size: var(--sl-font-size-small); font-weight: bold; color: var(--sl-color-neutral-500); margin-top: 6px; flex-shrink: 0;">
                                                    ${msg("Parameters:")}
                                                </div>

                                                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                                                    
                                                    ${meth.parameters.map((p, pi) => html`
                                                        <div style="display: flex; flex-direction: column; width: 100%;">
                                                            
                                                            <div style="display: flex; gap: 5px; align-items: center;">
                                                                
                                                                <sl-input 
                                                                    autocomplete="off"
                                                                    placeholder="name" 
                                                                    size="small" 
                                                                    style="flex: 1;" 
                                                                    .value=${live(p.name)} 
                                                                    @sl-input=${(e: any) => this._updateParameter(i, pi, 'name', e.target.value)}
                                                                    @sl-focus=${() => this._handleFocus(`meth-${i}-param-${pi}-name`)}
                                                                    @sl-blur=${(e: any) => { this._updateParameter(i, pi, 'name', e.target.value.trim()); this._handleBlur(`meth-${i}-param-${pi}-name`); }}
                                                                    class=${shouldShowError(`meth-${i}-param-${pi}-name`) ? 'has-error' : ''}
                                                                ></sl-input>

                                                                <sl-input 
                                                                    autocomplete="off"
                                                                    placeholder="type" 
                                                                    size="small" 
                                                                    style="flex: 1;" 
                                                                    .value=${live(p.type)} 
                                                                    @sl-input=${(e: any) => this._updateParameter(i, pi, 'type', e.target.value)}
                                                                    @sl-blur=${() => this._handleBlur(`meth-${i}-param-${pi}-type`)}
                                                                    @sl-focus=${() => this._handleFocus(`meth-${i}-param-${pi}-type`)}
                                                                    class=${shouldShowError(`meth-${i}-param-${pi}-type`) ? 'has-error' : ''}
                                                                ></sl-input>

                                                                <sl-button 
                                                                    size="small" 
                                                                    variant="danger" 
                                                                    outline 
                                                                    @click=${() => this._removeParameter(i, pi)}
                                                                    title=${msg("Delete Parameter")}
                                                                >
                                                                    <sl-icon src=${xIcon}></sl-icon>
                                                                </sl-button>
                                                            </div>

                                                            ${ (shouldShowError(`meth-${i}-param-${pi}-name`) || shouldShowError(`meth-${i}-param-${pi}-type`)) ? html`
                                                                <div style="color: var(--sl-color-danger-600); font-size: 0.7em; margin-top: 2px; display: flex; flex-direction: column;">
                                                                    ${shouldShowError(`meth-${i}-param-${pi}-name`) ? html`
                                                                        <div style="display: flex; align-items: center; gap: 4px;">
                                                                            <sl-icon name="exclamation-triangle"></sl-icon> 
                                                                            ${shouldShowError(`meth-${i}-param-${pi}-name`)?.message}
                                                                        </div>
                                                                    ` : ''}
                                                                    ${shouldShowError(`meth-${i}-param-${pi}-type`) ? html`
                                                                        <div style="display: flex; align-items: center; gap: 4px;">
                                                                            <sl-icon name="exclamation-triangle"></sl-icon> 
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
                                                        <sl-icon slot="prefix" src=${plusIcon}></sl-icon> ${msg("Add Parameter")}
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
                                ${msg("Add Method")}
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
                        ${msg("Delete")}
                    </sl-button>

                    <sl-button 
                        variant="primary" 
                        @click=${this._save}
                    >
                        ${msg("Save")}
                    </sl-button>
                </div>
            </sl-dialog>
        `;
    }
}