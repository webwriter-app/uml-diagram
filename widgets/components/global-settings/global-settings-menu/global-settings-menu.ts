import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlDetails, SlSwitch, SlDivider, SlSelect, SlOption, SlTabGroup, SlTab, SlTabPanel } from "@shoelace-style/shoelace";
import { GlobalSettings } from "../global-settings-model";
import { ClassSettings } from "../../class-object-diagram/models/class-settings-model";
import { SequenceSettings } from "../../sequence-diagram/models/sequence-settings-model";
import { ClassSettingsMenu } from "../../class-object-diagram/components/settings-menu/class-settings-menu";
import { SequenceDiagramSettingsMenu } from "../../sequence-diagram/components/settings-menu/sequence-diagram-settings-menu";
import styles from "./global-settings-menu.styles"

/**
 * Master Settings Menu for the entire Widget
 * Acts as a container that displays global settings directly and also contains
 * the specific settings menus for the different diagram types in sl-details below.
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
            "sl-tab-group": SlTabGroup,
            "sl-tab": SlTab,
            "sl-tab-panel": SlTabPanel,
            "class-settings-menu": ClassSettingsMenu,
            "sequence-diagram-settings-menu": SequenceDiagramSettingsMenu
        };
    }

    /** Styles are defined in the corresponding .styles file */
    static styles = [styles];

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

    render() {
        return html`
            <sl-tab-group>

                <sl-tab slot="nav" panel="global">Global</sl-tab>

                ${this.globalSettings.classDiagramEnabled ? html`
                    <sl-tab slot="nav" panel="class">Class</sl-tab>
                ` : ''}

                ${this.globalSettings.objectDiagramEnabled ? html`
                    <sl-tab slot="nav" panel="object">Object</sl-tab>
                ` : ''}

                ${this.globalSettings.sequenceDiagramEnabled ? html`
                    <sl-tab slot="nav" panel="sequence">Sequence</sl-tab>
                ` : ''}


                <sl-tab-panel name="global">
                    <div class="global-settings-container">
                        <sl-switch 
                            size="small" 
                            ?checked=${this.globalSettings.classDiagramEnabled} 
                            @sl-change=${(e: Event) => this._handleGlobalSwitchChange(e, 'classDiagramEnabled')}
                        >
                            ${msg("Enable Class Diagram")}
                        </sl-switch>

                        <sl-switch 
                            size="small" 
                            ?checked=${this.globalSettings.objectDiagramEnabled} 
                            @sl-change=${(e: Event) => this._handleGlobalSwitchChange(e, 'objectDiagramEnabled')}
                        >
                            ${msg("Enable Object Diagram")}
                        </sl-switch>

                        <sl-switch 
                            size="small" 
                            ?checked=${this.globalSettings.sequenceDiagramEnabled} 
                            @sl-change=${(e: Event) => this._handleGlobalSwitchChange(e, 'sequenceDiagramEnabled')}
                        >
                            ${msg("Enable Sequence Diagram")}
                        </sl-switch>

                        <sl-switch 
                            size="small" 
                            ?checked=${this.globalSettings.useCheckpoint} 
                            @sl-change=${(e: Event) => this._handleGlobalSwitchChange(e, 'useCheckpoint')}
                        >
                            ${msg("Use Checkpoint")}
                        </sl-switch>

                        <sl-select
                            size="small"
                            .value=${this.globalSettings.validationMode}
                            @sl-change=${this._handleValidationModeChange}
                            label=${msg("Validation Mode")}
                        >
                            <sl-option value="off">${msg("Off")}</sl-option>
                            <sl-option value="custom">${msg("Custom")}</sl-option>
                            <sl-option value="all">${msg("All")}</sl-option>
                        </sl-select>
                    </div>
                </sl-tab-panel>

                <sl-tab-panel name="class">
                    <class-settings-menu
                        .settings=${this.classSettings}
                        .globalSettings=${this.globalSettings}
                        diagramType="class-diagram"
                    ></class-settings-menu>
                </sl-tab-panel>

                <sl-tab-panel name="object">
                    <class-settings-menu
                        .settings=${this.objectSettings}
                        .globalSettings=${this.globalSettings}
                        diagramType="object-diagram"
                    ></class-settings-menu>
                </sl-tab-panel>

                <sl-tab-panel name="sequence">
                    <sequence-diagram-settings-menu
                        .settings=${this.sequenceSettings}
                        .globalSettings=${this.globalSettings}
                        diagramType="sequence-diagram"
                    ></sequence-diagram-settings-menu>
                </sl-tab-panel>

            </sl-tab-group>
        `;
    }
}