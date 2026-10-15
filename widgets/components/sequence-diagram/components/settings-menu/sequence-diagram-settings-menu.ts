import { html } from "lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SequenceSettings } from "../../models/sequence-settings-model";
import { SettingsMenu } from "../../../shared/settings-menu";

@localized()
export class SequenceDiagramSettingsMenu extends SettingsMenu<SequenceSettings> {

    @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

    render() {
        return html`
            <section class="section">
                <h3 class="section-heading">${msg("Allowed Elements")}</h3>
                ${this._renderSwitch('synchronousMessageExists', msg("Synchronous Message"))}
                ${this._renderSwitch('asynchronousMessageExists', msg("Asynchronous Message"))}
                ${this._renderSwitch('replyMessageExists', msg("Reply Message"))}
                ${this._renderSwitch('createMessageExists', msg("Create Message"))}
                ${this._renderSwitch('destroyMessageExists', msg("Destroy Message"))}
                ${this._renderSwitch('foundMessageExists', msg("Found Message"))}
                ${this._renderSwitch('lostMessageExists', msg("Lost Message"))}

                <sl-divider></sl-divider>

                ${this._renderSwitch('activationExists', msg("Activation"))}
                ${this._renderSwitch('iconsInObjectBoxExists', msg("Show icons in objects"))}

                <sl-divider></sl-divider>
                
                ${this._renderSwitch('optionalFragmentExists', msg("Optional Fragment"))}
                ${this._renderSwitch('loopFragmentExists', msg("Loop Fragment"))}
                ${this._renderSwitch('alternativeFragmentExists', msg("Alternative Fragment"))}
            </section>

            <section class="section">
                <h3 class="section-heading">${msg("Constraints")}</h3>
                ${this._renderNumberInput('maxNumberOfLifelines', msg("Maximum lifelines"), 1)}
                ${this._renderNumberInput('maxNumberOfMessages', msg("Maximum messages"), 1)}
                ${this._renderNumberInput('maxNumberOfFragments', msg("Maximum fragments"), 1)}
                ${this._renderNumberInput('maxNumberOfActivations', msg("Maximum activations"), 1)}
            </section>

            ${this._renderValidationSection([[
                ['checkForEmptyGuards', msg("No empty guard conditions")],
                ['checkForEmptyClassNames', msg("No empty class names")],
                ['checkForEmptyObjectNames', msg("No empty object names")],
                ['checkForFirstLetterOfClass', msg("Class naming rules")],
                ['checkForFirstLetterOfMessages', msg("Message naming rules")],
                ['checkForFirstLetterOfObject', msg("Object naming rules")],
                ['checkForFragmentOverlap', msg("Prevent overlapping fragments")]
            ]])}
        `;
    }
}
