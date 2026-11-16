import { LitElementWw } from "@webwriter/lit";
import { widgetMsg } from "@webwriter/lit/localize";
import { html } from "lit";
import { property } from "lit/decorators.js";
import { default as SlInput } from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import { default as SlSwitch } from "@shoelace-style/shoelace/dist/components/switch/switch.component.js";
import { default as SlDivider } from "@shoelace-style/shoelace/dist/components/divider/divider.component.js";
import { ClassSettings } from "../../model/class-object-diagram/class-settings-model";
import styles from "../shared/settings-menu.styles";
import { GlobalSettings } from "../../model/global-settings/global-settings-model";

/** Settings menu component for the Class and Object Diagram */
export class ClassSettingsMenu extends LitElementWw {
    msg = widgetMsg(this);

    /** styles are shared with the sequence diagram settings menu */
    static styles = [styles];

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-switch": SlSwitch,
            "sl-input": SlInput,
            "sl-divider": SlDivider
        };
    }

    /** Property to hold the passed down instance of the class settings */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();
    
    /** Property to hold the passed down current diagram type to decide if this is object or class settings */
    @property() accessor diagramType: string = 'class-diagram';

    /** Property to hold the passed down instance of the global settings */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();


    // --------------------------------------------------------------------------------------------------------
    // Handlers to dispatch events to inform the widget about changes
    // --------------------------------------------------------------------------------------------------------

    /** send new ClassSettings object with updated content to main widget */
    private _dispatchUpdate(newSettings: ClassSettings) {
        this.dispatchEvent(new CustomEvent('settings-changed', {
            detail: {
                diagramType: this.diagramType,
                updatedSettings: newSettings
            },
            bubbles: true,
            composed: true
        }));
    }

    /** store changes if a single switch is clicked */
    private _handleSwitchChange(e: Event, key: keyof ClassSettings) {
        const target = e.target as HTMLInputElement;
        const newSettings = new ClassSettings();
        Object.assign(newSettings, this.settings);
        Object.assign(newSettings, { [key]: target.checked });
        this._dispatchUpdate(newSettings);
    }

    /** store changes if a number setting is changed */
    private _handleNumberChange(e: Event, key: keyof ClassSettings) {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value);
        const newSettings = new ClassSettings();
        Object.assign(newSettings, this.settings);
        if (!isNaN(value)) {
            Object.assign(newSettings, { [key]: value });
        }
        this._dispatchUpdate(newSettings);
    }

    /** Maps technical keys to readable labels (text that is shown in the settings menu) */
    private _getLabel(key: string): string {
        const labels: Record<string, string> = {
            // In Class/Object Dialog
            checkEmptyClassNames: this.msg("No empty class names"),
            checkEmptyObjectNames: this.msg("No empty object names"),
            checkEmptyAttrMethParamFields: this.msg("No empty attribute, method, or parameter fields"),
            checkConstructorReturnType: this.msg("Constructors have no return type"),
            checkUniqueNames: this.msg("Unique names"),
            checkNamingConventions: this.msg("Naming conventions"),
            checkModifiers: this.msg("Valid modifiers"),
            checkClassConnections: this.msg("Validate type change"),
            checkNoConstructorsInObjects: this.msg("No constructors in objects"),
            // In Relation/Link Dialog
            checkDependencyStereotypeSyntax: this.msg("Dependency stereotype syntax"),
            checkRelationMultiplicitySyntax: this.msg("Multiplicity syntax"),
            protectedExists: this.msg("Protected visibility"),
            packageExists: this.msg("Package visibility"),
            // In the Editor
            checkRelationalLogic: this.msg("Prevent illegal connections"),
        };
        return labels[key] || key;
    }

    // --------------------------------------------------------------------------------------------------------
    // render method
    // --------------------------------------------------------------------------------------------------------

    render() {
        const isObjectDiagram = this.diagramType === 'object-diagram';
        // Check this in class and object diagram
        let entityValidationKeys: (keyof ClassSettings)[] = [
            "checkEmptyObjectNames", "checkNoConstructorsInObjects", "checkClassConnections", "checkEmptyAttrMethParamFields", "checkModifiers", "checkEmptyClassNames", "checkUniqueNames", "checkNamingConventions"
        ];
        // Check this only in class diagram
        if (!isObjectDiagram) {
            entityValidationKeys.push("checkConstructorReturnType");
        }

        let relationValidationKeys: (keyof ClassSettings)[] = [];
        if (!isObjectDiagram) {
            relationValidationKeys.push("checkRelationMultiplicitySyntax", "checkDependencyStereotypeSyntax");
        }

        let archValidationKeys: (keyof ClassSettings)[] = [];
        if (!isObjectDiagram) {
            archValidationKeys = ["checkRelationalLogic"];
        }

        const validationDisabled = this.globalSettings.validationMode !== 'custom';
        const renderValidationSwitches = (keys: (keyof ClassSettings)[]) => keys.map(key => html`
            <sl-switch
                size="small"
                ?checked=${this.settings[key as keyof ClassSettings]}
                ?disabled=${validationDisabled}
                @sl-change=${(e: Event) => this._handleSwitchChange(e, key)}
            >
                ${this._getLabel(key)}
            </sl-switch>
        `);

        return html`
            <section class="section">
                <h3 class="section-heading">${this.msg("Allowed Elements")}</h3>

                ${!isObjectDiagram ? html`
                    <sl-switch size="small" ?checked=${this.settings.abstractExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'abstractExists')}>${this.msg("Abstract Class")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.parameterizedExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'parameterizedExists')}>${this.msg("Parameterized Class")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.interfaceExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'interfaceExists')}>${this.msg("Interface")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.annotationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'annotationExists')}>${this.msg("Annotation")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.recordExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'recordExists')}>${this.msg("Record")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.enumExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'enumExists')}>${this.msg("Enumeration")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.dataTypeExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'dataTypeExists')}>${this.msg("Data Type")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.objectExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'objectExists')}>${this.msg("Object")}</sl-switch>
                    <sl-divider></sl-divider>
                ` : ''}

                <sl-switch size="small" ?checked=${this.settings.associationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'associationExists')}>
                    ${isObjectDiagram ? this.msg("Link (Directed)") : this.msg("Association (Directed)")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.associationBidirectionalExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'associationBidirectionalExists')}>
                    ${isObjectDiagram ? this.msg("Link (Bidirectional)") : this.msg("Association (Bidirectional)")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.associationUndirectedExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'associationUndirectedExists')}>
                    ${isObjectDiagram ? this.msg("Link (Undirected)") : this.msg("Association (Undirected)")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.compositionExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'compositionExists')}>${this.msg("Composition")}</sl-switch>
                <sl-switch size="small" ?checked=${this.settings.aggregationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'aggregationExists')}>${this.msg("Aggregation")}</sl-switch>

                ${!isObjectDiagram ? html`
                    <sl-switch size="small" ?checked=${this.settings.inheritanceExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'inheritanceExists')}>${this.msg("Inheritance")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.dependencyExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'dependencyExists')}>${this.msg("Dependency")}</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.realizationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'realizationExists')}>${this.msg("Realization")}</sl-switch>
                    <sl-divider></sl-divider>
                    <sl-switch size="small" ?checked=${this.settings.protectedExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'protectedExists')}>protected (#)</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.packageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'packageExists')}>package (~)</sl-switch>
                ` : ''}
            </section>

            ${(isObjectDiagram || this.settings.objectExists) ? html`
                <section class="section">
                    <h3 class="section-heading">${this.msg("Object Display Options")}</h3>
                    <sl-switch size="small" ?checked=${this.settings.showMethodsInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showMethodsInObjects')}>
                        ${this.msg("Show methods")}
                    </sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.showParametersInObjects} ?disabled=${!this.settings.showMethodsInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showParametersInObjects')}>
                        ${this.msg("Show parameters")}
                    </sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.showModifiersInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showModifiersInObjects')}>
                        ${this.msg("Show modifiers (static, final, …)")}
                    </sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.showVisibilityInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showVisibilityInObjects')}>
                        ${this.msg("Show visibility (+, -, …)")}
                    </sl-switch>
                </section>
            ` : ''}

            <section class="section">
                <h3 class="section-heading">${this.msg("Constraints")}</h3>
                <sl-input
                    type="number"
                    label=${this.msg("Maximum entities")}
                    size="small"
                    min="0"
                    .value=${this.settings.maxClasses.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxClasses')}
                ></sl-input>
                <sl-input
                    type="number"
                    label=${this.msg("Maximum connections (total)")}
                    size="small"
                    min="0"
                    .value=${this.settings.maxRelations.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxRelations')}
                ></sl-input>
                <sl-input
                    type="number"
                    label=${this.msg("Maximum connections per pair")}
                    size="small"
                    min="0"
                    .value=${this.settings.maxNumberRelationsBetweenTwoClasses.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberRelationsBetweenTwoClasses')}
                ></sl-input>
            </section>

            <section class="section">
                <h3 class="section-heading">${this.msg("Validation")}</h3>
                ${validationDisabled ? html`
                    <p class="help-text">${this.msg("Set the validation mode to “Custom” to configure individual rules.")}</p>
                ` : ''}

                ${renderValidationSwitches(entityValidationKeys)}

                ${relationValidationKeys.length > 0 ? html`
                    <sl-divider></sl-divider>
                    ${renderValidationSwitches(relationValidationKeys)}
                ` : ''}

                ${archValidationKeys.length > 0 ? html`
                    <sl-divider></sl-divider>
                    ${renderValidationSwitches(archValidationKeys)}
                ` : ''}
            </section>
        `;
    }
}