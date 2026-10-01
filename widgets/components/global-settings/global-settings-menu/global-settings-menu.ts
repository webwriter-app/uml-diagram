import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlDetails, SlSwitch, SlDivider, SlSelect, SlOption } from "@shoelace-style/shoelace";
import { GlobalSettings } from "../global-settings-model";
import { ClassSettings } from "../../class-object-diagram/models/class-settings-model";
import { SequenceSettings } from "../../sequence-diagram/models/sequence-settings-model";
import { ClassSettingsMenu } from "../../class-object-diagram/components/settings-menu/class-settings-menu";
import { SequenceDiagramSettingsMenu } from "../../sequence-diagram/components/settings-menu/sequence-diagram-settings-menu";
import sharedStyles from "../../shared/settings-menu.styles";
import styles from "./global-settings-menu.styles"

/**
 * Master Settings Menu for the entire Widget (shown in the options panel)
 * Shows the general settings at the top, followed by one expandable section per diagram type
 * with its enable switch and the diagram specific settings menu.
 */
@localized()
export class GlobalSettingsMenu extends LitElementWw {

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-details": SlDetails,
            "sl-switch": SlSwitch,
            "sl-divider": SlDivider,
            "sl-select": SlSelect,
            "sl-option": SlOption,
            "class-settings-menu": ClassSettingsMenu,
            "sequence-diagram-settings-menu": SequenceDiagramSettingsMenu
        };
    }

    /** Styles are defined in the corresponding .styles file */
    static styles = [sharedStyles, styles];

    /** Settings instances for all diagram types, passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();
    @property({ attribute: false }) accessor classSettings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();
    @property({ attribute: false }) accessor objectSettings: ClassSettings = ClassSettings.getInitialObjectDiagramSettings();
    @property({ attribute: false }) accessor sequenceSettings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

    // --------------------------------------------------------------------------------------------------------
    // Handlers
    // --------------------------------------------------------------------------------------------------------

    /** Handler for changes in the global settings */
    private _handleGlobalSwitchChange(e: Event, key: keyof GlobalSettings) {
        const target = e.target as HTMLInputElement;
        
        // Create a new updated settings object
        const newSettings = new GlobalSettings();
        Object.assign(newSettings, this.globalSettings);
        (newSettings as any)[key] = target.checked;

        // Prevent deactivating all diagrams — at least one must remain active
        const anyEnabled = newSettings.classDiagramEnabled || 
                        newSettings.objectDiagramEnabled || 
                        newSettings.sequenceDiagramEnabled;
        if (!anyEnabled) {
            (target as any).checked = true;
            return;
        }

        // Dispatch the generic settings-changed event
        this.dispatchEvent(new CustomEvent('settings-changed', {
            detail: { 
                diagramType: 'global-settings', 
                updatedSettings: newSettings 
            },
            bubbles: true,
            composed: true
        }));
    }

    /** Handler for changes in the validation mode selector */
    private _handleValidationModeChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        const newSettings = new GlobalSettings();
        Object.assign(newSettings, this.globalSettings);
        newSettings.validationMode = target.value as 'all' | 'off' | 'custom';
        this.dispatchEvent(new CustomEvent('settings-changed', {
            detail: { 
                diagramType: 'global-settings', 
                updatedSettings: newSettings 
            },
            bubbles: true,
            composed: true
        }));
    }

    // --------------------------------------------------------------------------------------------------------
    // Render Method
    // --------------------------------------------------------------------------------------------------------

    /** Renders the expandable section of one diagram type with its enable switch and settings */
    private _renderDiagramSection(label: string, enabledKey: 'classDiagramEnabled' | 'objectDiagramEnabled' | 'sequenceDiagramEnabled', content: unknown) {
        const enabled = this.globalSettings[enabledKey];
        const enabledCount = [this.globalSettings.classDiagramEnabled, this.globalSettings.objectDiagramEnabled, this.globalSettings.sequenceDiagramEnabled].filter(Boolean).length;
        // at least one diagram has to stay enabled
        const isLastEnabled = enabled && enabledCount === 1;

        // keep clicks and key presses on the switch from also expanding/collapsing the section
        const keepFromHeader = (e: Event) => e.stopPropagation();

        return html`
            <sl-details>
                <div slot="summary" class="diagram-summary">
                    <sl-switch
                        size="small"
                        aria-label=${msg("Enabled")}
                        ?checked=${enabled}
                        ?disabled=${isLastEnabled}
                        @click=${keepFromHeader}
                        @keydown=${keepFromHeader}
                        @sl-change=${(e: Event) => this._handleGlobalSwitchChange(e, enabledKey)}
                    ></sl-switch>
                    <span>${label}</span>
                </div>
                ${content}
            </sl-details>
        `;
    }

    render() {
        return html`
            <section class="section">
                <sl-select
                    size="small"
                    label=${msg("Validation Mode")}
                    .value=${this.globalSettings.validationMode}
                    @sl-change=${this._handleValidationModeChange}
                >
                    <sl-option value="off">${msg("Off")}</sl-option>
                    <sl-option value="custom">${msg("Custom")}</sl-option>
                    <sl-option value="all">${msg("All")}</sl-option>
                </sl-select>
                <sl-switch
                    size="small"
                    ?checked=${this.globalSettings.useCheckpoint}
                    @sl-change=${(e: Event) => this._handleGlobalSwitchChange(e, 'useCheckpoint')}
                >
                    ${msg("Use Checkpoint")}
                </sl-switch>
            </section>

            <div class="diagram-sections">
                ${this._renderDiagramSection(msg("Class Diagram"), 'classDiagramEnabled', html`
                    <class-settings-menu
                        .settings=${this.classSettings}
                        .globalSettings=${this.globalSettings}
                        diagramType="class-diagram"
                    ></class-settings-menu>
                `)}

                ${this._renderDiagramSection(msg("Object Diagram"), 'objectDiagramEnabled', html`
                    <class-settings-menu
                        .settings=${this.objectSettings}
                        .globalSettings=${this.globalSettings}
                        diagramType="object-diagram"
                    ></class-settings-menu>
                `)}

                ${this._renderDiagramSection(msg("Sequence Diagram"), 'sequenceDiagramEnabled', html`
                    <sequence-diagram-settings-menu
                        .settings=${this.sequenceSettings}
                        .globalSettings=${this.globalSettings}
                        diagramType="sequence-diagram"
                    ></sequence-diagram-settings-menu>
                `)}
            </div>
        `;
    }
}