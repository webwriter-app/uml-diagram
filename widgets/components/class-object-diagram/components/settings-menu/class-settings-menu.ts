import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlInput, SlSwitch, SlDivider } from "@shoelace-style/shoelace";
import { ClassSettings } from "../../models/class-settings-model";
import styles from "../../../shared/settings-menu.styles";
import { GlobalSettings } from "../../../global-settings/global-settings-model";

/** Settings menu component for the Class and Object Diagram */
@localized()
export class ClassSettingsMenu extends LitElementWw {

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
        (newSettings as any)[key] = target.checked;
        this._dispatchUpdate(newSettings);
    }

    /** store changes if a number setting is changed */
    private _handleNumberChange(e: Event, key: keyof ClassSettings) {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value);
        const newSettings = new ClassSettings();
        Object.assign(newSettings, this.settings);
        if (!isNaN(value)) {
            (newSettings as any)[key] = value;
        }
        this._dispatchUpdate(newSettings);
    }

    /** Maps technical keys to readable labels (text that is shown in the settings menu) */
    private _getLabel(key: string): string {
        const labels: Record<string, string> = {
            // In Class/Object Dialog
            checkEmptyClassNames: msg("No empty class names"),
            checkEmptyObjectNames: msg("No empty object names"),
            checkEmptyAttrMethParamFields: msg("No empty attribute/ method fields"),
            checkConstructorReturnType: msg("Constructors have no return type"),
            checkUniqueNames: msg("Unique names"),
            checkNamingConventions: msg("Naming conventions"),
            checkModifiers: msg("Valid modifiers"),
            checkClassConnections: msg("Validate type change"),
            checkNoConstructorsInObjects: msg("No constructors in objects"),
            // In Relation/Link Dialog
            checkDependencyStereotypeSyntax: msg("Dependency stereotype syntax"),
            checkRelationMultiplicitySyntax: msg("Multiplicity syntax"),
            protectedExists: msg("Protected visibility"),
            packageExists: msg("Package visibility"),
            // In the Editor
            checkRelationalLogic: msg("Prevent illegal connections"),
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
                ?checked=${(this.settings as any)[key]}
                ?disabled=${validationDisabled}
                @sl-change=${(e: Event) => this._handleSwitchChange(e, key)}
            >
                ${this._getLabel(key)}
            </sl-switch>
        `);

        return html`
            <section class="section">
                <h3 class="section-heading">${msg("Allowed Elements")}</h3>

                ${!isObjectDiagram ? html`
                    <sl-switch size="small" ?checked=${this.settings.abstractExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'abstractExists')}>Abstract Class</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.parameterizedExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'parameterizedExists')}>Parameterized Class</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.interfaceExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'interfaceExists')}>Interface</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.annotationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'annotationExists')}>Annotation</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.recordExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'recordExists')}>Record</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.enumExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'enumExists')}>Enumeration</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.dataTypeExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'dataTypeExists')}>Datatype</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.objectExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'objectExists')}>Object</sl-switch>
                    <sl-divider></sl-divider>
                ` : ''}

                <sl-switch size="small" ?checked=${this.settings.associationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'associationExists')}>
                    ${isObjectDiagram ? msg("Link") : msg("Association")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.associationBidirectionalExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'associationBidirectionalExists')}>
                    ${isObjectDiagram ? msg("Link (Bi-Dir)") : msg("Association (Bi-Dir)")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.associationUndirectedExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'associationUndirectedExists')}>
                    ${isObjectDiagram ? msg("Link (Undirected)") : msg("Association (Undirected)")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.compositionExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'compositionExists')}>Composition</sl-switch>
                <sl-switch size="small" ?checked=${this.settings.aggregationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'aggregationExists')}>Aggregation</sl-switch>

                ${!isObjectDiagram ? html`
                    <sl-switch size="small" ?checked=${this.settings.inheritanceExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'inheritanceExists')}>Inheritance</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.dependencyExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'dependencyExists')}>Dependency</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.realizationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'realizationExists')}>Realization</sl-switch>
                    <sl-divider></sl-divider>
                    <sl-switch size="small" ?checked=${this.settings.protectedExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'protectedExists')}>Protected (#)</sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.packageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'packageExists')}>Package (~)</sl-switch>
                ` : ''}
            </section>

            ${(isObjectDiagram || this.settings.objectExists) ? html`
                <section class="section">
                    <h3 class="section-heading">${msg("Object Display Options")}</h3>
                    <sl-switch size="small" ?checked=${this.settings.showMethodsInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showMethodsInObjects')}>
                        ${msg("Show Methods")}
                    </sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.showParametersInObjects} ?disabled=${!this.settings.showMethodsInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showParametersInObjects')}>
                        ${msg("Show Parameters")}
                    </sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.showModifiersInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showModifiersInObjects')}>
                        ${msg("Show Modifiers (static, final...)")}
                    </sl-switch>
                    <sl-switch size="small" ?checked=${this.settings.showVisibilityInObjects} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'showVisibilityInObjects')}>
                        ${msg("Show Visibility (+, -, ...)")}
                    </sl-switch>
                </section>
            ` : ''}

            <section class="section">
                <h3 class="section-heading">${msg("Constraints")}</h3>
                <sl-input
                    type="number"
                    label=${msg("Max. Entities")}
                    size="small"
                    min="0"
                    .value=${this.settings.maxClasses.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxClasses')}
                ></sl-input>
                <sl-input
                    type="number"
                    label=${msg("Max. Connections (Total)")}
                    size="small"
                    min="0"
                    .value=${this.settings.maxRelations.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxRelations')}
                ></sl-input>
                <sl-input
                    type="number"
                    label=${msg("Max. Connections (per Pair)")}
                    size="small"
                    min="0"
                    .value=${this.settings.maxNumberRelationsBetweenTwoClasses.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberRelationsBetweenTwoClasses')}
                ></sl-input>
            </section>

            <section class="section">
                <h3 class="section-heading">${msg("Validation")}</h3>
                ${validationDisabled ? html`
                    <p class="help-text">${msg("Set Validation Mode to 'Custom' to configure individual rules")}</p>
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