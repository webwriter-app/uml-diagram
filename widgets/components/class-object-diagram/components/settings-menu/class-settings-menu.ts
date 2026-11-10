import { html } from "lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { ClassSettings } from "../../models/class-settings-model";
import { SettingsMenu } from "../../../shared/settings-menu";

@localized()
export class ClassSettingsMenu extends SettingsMenu<ClassSettings> {

    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    private _getLabel(key: string): string {
        const labels: Record<string, string> = {
            // In Class/Object Dialog
            checkEmptyClassNames: msg("No empty class names"),
            checkEmptyObjectNames: msg("No empty object names"),
            checkEmptyAttrMethParamFields: msg("No empty attribute, method, or parameter fields"),
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

    render() {
        const isObjectDiagram = this.diagramType === 'object-diagram';
        let entityValidationKeys: (keyof ClassSettings)[] = [
            "checkEmptyObjectNames", "checkNoConstructorsInObjects", "checkClassConnections", "checkEmptyAttrMethParamFields", "checkModifiers", "checkEmptyClassNames", "checkUniqueNames", "checkNamingConventions"
        ];
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

        return html`
            <section class="section">
                <h3 class="section-heading">${msg("Allowed Elements")}</h3>

                ${!isObjectDiagram ? html`
                    ${this._renderSwitch('abstractExists', msg("Abstract Class"))}
                    ${this._renderSwitch('parameterizedExists', msg("Parameterized Class"))}
                    ${this._renderSwitch('interfaceExists', msg("Interface"))}
                    ${this._renderSwitch('annotationExists', msg("Annotation"))}
                    ${this._renderSwitch('recordExists', msg("Record"))}
                    ${this._renderSwitch('enumExists', msg("Enumeration"))}
                    ${this._renderSwitch('dataTypeExists', msg("Data Type"))}
                    ${this._renderSwitch('objectExists', msg("Object"))}
                    <sl-divider></sl-divider>
                ` : ''}

                ${this._renderSwitch('associationExists', isObjectDiagram ? msg("Link (Directed)") : msg("Association (Directed)"))}
                ${this._renderSwitch('associationBidirectionalExists', isObjectDiagram ? msg("Link (Bidirectional)") : msg("Association (Bidirectional)"))}
                ${this._renderSwitch('associationUndirectedExists', isObjectDiagram ? msg("Link (Undirected)") : msg("Association (Undirected)"))}
                ${this._renderSwitch('compositionExists', msg("Composition"))}
                ${this._renderSwitch('aggregationExists', msg("Aggregation"))}

                ${!isObjectDiagram ? html`
                    ${this._renderSwitch('inheritanceExists', msg("Inheritance"))}
                    ${this._renderSwitch('dependencyExists', msg("Dependency"))}
                    ${this._renderSwitch('realizationExists', msg("Realization"))}
                    <sl-divider></sl-divider>
                    ${this._renderSwitch('protectedExists', "protected (#)")}
                    ${this._renderSwitch('packageExists', "package (~)")}
                ` : ''}
            </section>

            ${(isObjectDiagram || this.settings.objectExists) ? html`
                <section class="section">
                    <h3 class="section-heading">${msg("Object Display Options")}</h3>
                    ${this._renderSwitch('showMethodsInObjects', msg("Show methods"))}
                    ${this._renderSwitch('showParametersInObjects', msg("Show parameters"), !this.settings.showMethodsInObjects)}
                    ${this._renderSwitch('showModifiersInObjects', msg("Show modifiers (static, final, …)"))}
                    ${this._renderSwitch('showVisibilityInObjects', msg("Show visibility (+, -, …)"))}
                </section>
            ` : ''}

            <section class="section">
                <h3 class="section-heading">${msg("Constraints")}</h3>
                ${this._renderNumberInput('maxClasses', msg("Maximum entities"), 0)}
                ${this._renderNumberInput('maxRelations', msg("Maximum connections (total)"), 0)}
                ${this._renderNumberInput('maxNumberRelationsBetweenTwoClasses', msg("Maximum connections per pair"), 0)}
            </section>

            ${this._renderValidationSection([entityValidationKeys, relationValidationKeys, archValidationKeys]
                .map(keys => keys.map(key => [key, this._getLabel(key)])))}
        `;
    }
}
