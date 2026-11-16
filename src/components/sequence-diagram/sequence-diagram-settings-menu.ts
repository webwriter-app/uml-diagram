import { LitElementWw } from "@webwriter/lit";
import { widgetMsg } from "@webwriter/lit/localize";
import { html } from "lit";
import { property } from "lit/decorators.js";
import { default as SlInput } from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import { default as SlDivider } from "@shoelace-style/shoelace/dist/components/divider/divider.component.js";
import { default as SlSwitch } from "@shoelace-style/shoelace/dist/components/switch/switch.component.js";
import { SequenceSettings } from "../../model/sequence-diagram/sequence-settings-model";
import styles from "../shared/settings-menu.styles";
import { GlobalSettings } from "../../model/global-settings/global-settings-model";

/** Configuration menu for the Sequence Diagram Editor */
export class SequenceDiagramSettingsMenu extends LitElementWw {
    msg = widgetMsg(this);

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
            Object.assign(newSettings, { [key]: target.checked });
            this._dispatchUpdate(newSettings);
        }

    /** store change if a number setting is changed */
    private _handleNumberChange(e: Event, key: keyof SequenceSettings) {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value);
        
        const newSettings = new SequenceSettings();
        Object.assign(newSettings, this.settings);
        
        if (!isNaN(value)) {
            Object.assign(newSettings, { [key]: value });
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
                <h3 class="section-heading">${this.msg("Allowed Elements")}</h3>
                <sl-switch size="small" ?checked=${this.settings.synchronousMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'synchronousMessageExists')}>
                    ${this.msg("Synchronous Message")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.asynchronousMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'asynchronousMessageExists')}>
                    ${this.msg("Asynchronous Message")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.replyMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'replyMessageExists')}>
                    ${this.msg("Reply Message")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.createMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'createMessageExists')}>
                    ${this.msg("Create Message")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.destroyMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'destroyMessageExists')}>
                    ${this.msg("Destroy Message")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.foundMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'foundMessageExists')}>
                    ${this.msg("Found Message")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.lostMessageExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'lostMessageExists')}>
                    ${this.msg("Lost Message")}
                </sl-switch>

                <sl-divider></sl-divider>

                <sl-switch size="small" ?checked=${this.settings.activationExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'activationExists')}>
                    ${this.msg("Activation")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.iconsInObjectBoxExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'iconsInObjectBoxExists')}>
                    ${this.msg("Show icons in objects")}
                </sl-switch>

                <sl-divider></sl-divider>
                
                <sl-switch size="small" ?checked=${this.settings.optionalFragmentExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'optionalFragmentExists')}>
                    ${this.msg("Optional Fragment")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.loopFragmentExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'loopFragmentExists')}>
                    ${this.msg("Loop Fragment")}
                </sl-switch>
                <sl-switch size="small" ?checked=${this.settings.alternativeFragmentExists} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'alternativeFragmentExists')}>
                    ${this.msg("Alternative Fragment")}
                </sl-switch>
            </section>

            <section class="section">
                <h3 class="section-heading">${this.msg("Constraints")}</h3>
                <sl-input 
                    type="number" 
                    label=${this.msg("Maximum lifelines")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfLifelines.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfLifelines')}
                ></sl-input>

                <sl-input 
                    type="number" 
                    label=${this.msg("Maximum messages")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfMessages.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfMessages')}
                ></sl-input>

                <sl-input 
                    type="number" 
                    label=${this.msg("Maximum fragments")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfFragments.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfFragments')}
                ></sl-input>

                <sl-input 
                    type="number" 
                    label=${this.msg("Maximum activations")}
                    size="small"
                    min="1"
                    .value=${this.settings.maxNumberOfActivations.toString()}
                    @sl-change=${(e: Event) => this._handleNumberChange(e, 'maxNumberOfActivations')}
                ></sl-input>
            </section>

            <section class="section">
                <h3 class="section-heading">${this.msg("Validation")}</h3>
                ${validationDisabled ? html`
                    <p class="help-text">${this.msg("Set the validation mode to “Custom” to configure individual rules.")}</p>
                ` : ''}

                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForEmptyGuards} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForEmptyGuards')}>
                    ${this.msg("No empty guard conditions")}
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForEmptyClassNames} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForEmptyClassNames')}>
                    ${this.msg("No empty class names")}
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForEmptyObjectNames} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForEmptyObjectNames')}>
                    ${this.msg("No empty object names")}
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFirstLetterOfClass} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFirstLetterOfClass')}>
                    ${this.msg("Class naming rules")}
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFirstLetterOfMessages} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFirstLetterOfMessages')}>
                    ${this.msg("Message naming rules")}
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFirstLetterOfObject} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFirstLetterOfObject')}>
                    ${this.msg("Object naming rules")}
                </sl-switch>
                <sl-switch size="small" ?disabled=${validationDisabled} ?checked=${this.settings.checkForFragmentOverlap} @sl-change=${(e: Event) => this._handleSwitchChange(e, 'checkForFragmentOverlap')}>
                    ${this.msg("Prevent overlapping fragments")}
                </sl-switch>
            </section>
        `;
    }
}