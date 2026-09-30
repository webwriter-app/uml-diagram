import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlInput, SlDivider, SlSwitch } from "@shoelace-style/shoelace";
import { SequenceSettings } from "../../models/sequence-settings-model";
import styles from "../../../shared/settings-menu.styles";
import { GlobalSettings } from "../../../global-settings/global-settings-model";

/** Configuration menu for the Sequence Diagram Editor */
@localized()
export class SequenceDiagramSettingsMenu extends LitElementWw {

    /** styles are shared with the class/object diagram settings menu */
    static styles = [styles];

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-input": SlInput,
            "sl-divider": SlDivider,
            "sl-switch": SlSwitch
        };
    }

    /** Property to hold the passed down instance of the sequence diagram settings */
    @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();
    
    /** Property to hold the passed down current diagram type */
    @property() accessor diagramType: string = 'sequence-diagram';

    /** Property to hold the passed down instace of the global settings */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    // --------------------------------------------------------------------------------------------------------
    // Handlers
    // --------------------------------------------------------------------------------------------------------

    /** send new SequenceSettings object with updated content and diagramType to main widget */
    private _dispatchUpdate(newSettings: SequenceSettings) {
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
        private _handleSwitchChange(e: Event, key: keyof SequenceSettings) {
            const target = e.target as HTMLInputElement;
            const newSettings = new SequenceSettings();
            Object.assign(newSettings, this.settings);
            (newSettings as any)[key] = target.checked;
            this._dispatchUpdate(newSettings);
        }

    /** store change if a number setting is changed */
    private _handleNumberChange(e: Event, key: keyof SequenceSettings) {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value);
        
        const newSettings = new SequenceSettings();
        Object.assign(newSettings, this.settings);
        
        if (!isNaN(value)) {
            (newSettings as any)[key] = value;
        }
        this._dispatchUpdate(newSettings);
    }

    // --------------------------------------------------------------------------------------------------------
    // render method
    // --------------------------------------------------------------------------------------------------------

    render() {
        const validationDisabled = this.globalSettings.validationMode !== 'custom';

        return html`
            <section class="section">
                <h3 class="section-heading">${msg("Allowed Elements")}</h3>
                <sl-switch size="small" ?checked=${this.settings.synchronousMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'synchronousMessageExists')}>
                    Synchronous Message
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.asynchronousMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'asynchronousMessageExists')}>
                    Asynchronous Message
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.replyMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'replyMessageExists')}>
                    Reply Message
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.createMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'createMessageExists')}>
                    Create Message
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.destroyMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'destroyMessageExists')}>
                    Destroy Message
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.foundMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'foundMessageExists')}>
                    Found Message
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.lostMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'lostMessageExists')}>
                    Lost Message
                </sl-switch>

                <sl-divider></sl-divider>

                <sl-switch size="small" ?checked=${this.settings.activationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'activationExists')}>
                    Activation Bar
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.iconsInObjectBoxExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'iconsInObjectBoxExists')}>
                    Icons in Objects
                </sl-switch>

                <sl-divider></sl-divider>
                
                <sl-switch size="small" ?checked=${this.settings.optionalFragmentExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'optionalFragmentExists')}>
                    Optional Fragment
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.loopFragmentExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'loopFragmentExists')}>
                    Loop Fragment
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.alternativeFragmentExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'alternativeFragmentExists')}>
                    Alternative Fragment
                </sl-switch>
            </section>

            <section class="section">
                <h3 class="section-heading">${msg("Constraints")}</h3>
                <sl-input 
                    type="number" 
                    label=${msg("Max. Objects (Lifelines)")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfLifelines.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfLifelines')}
                ></sl-input>

                <sl-input 
                    type="number" 
                    label=${msg("Max. Messages")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfMessages.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfMessages')}
                ></sl-input>

                <sl-input 
                    type="number" 
                    label=${msg("Max. Fragments")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfFragments.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfFragments')}
                ></sl-input>

                <sl-input 
                    type="number" 
                    label=${msg("Max. Activations")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfActivations.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfActivations')}
                ></sl-input>
            </section>

            <section class="section">
                <h3 class="section-heading">${msg("Validation")}</h3>
                ${validationDisabled ? html`
                    <p class="help-text">${msg("Set Validation Mode to 'Custom' to configure individual rules")}</p>
                ` : ''}

                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForEmptyGuards} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForEmptyGuards')}>
                    Empty Guards
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForEmptyClassNames} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForEmptyClassNames')}>
                    Empty Class Names
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForEmptyObjectNames} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForEmptyObjectNames')}>
                    Empty Object Names
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFirstLetterOfClass} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFirstLetterOfClass')}>
                    Class Naming Rules
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFirstLetterOfMessages} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFirstLetterOfMessages')}>
                    Message Naming Rules
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFirstLetterOfObject} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFirstLetterOfObject')}>
                    Object Naming Rules
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFragmentOverlap} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFragmentOverlap')}>
                    Overlapping Fragments
                </sl-switch>
            </section>
        `;
    }
}