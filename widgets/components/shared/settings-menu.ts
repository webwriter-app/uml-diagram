import { css, html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg } from "@lit/localize";
import { SlInput, SlSwitch, SlDivider } from "@shoelace-style/shoelace";
import { GlobalSettings } from "../global-settings/global-settings-model";

export const settingsMenuStyles = css`

    :host {
        display: flex;
        flex-direction: column;
        gap: var(--sl-spacing-large);
        font-family: var(--sl-font-sans);
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: var(--sl-spacing-x-small);
    }

    /* Section heading, styled like a Shoelace menu label */
    .section-heading {
        margin: 0;
        font-size: var(--sl-font-size-small);
        font-weight: var(--sl-font-weight-semibold);
        color: var(--sl-color-neutral-500);
    }

    /* Hint below a heading, styled like Shoelace help text */
    .help-text {
        margin: 0;
        font-size: var(--sl-input-help-text-font-size-small);
        color: var(--sl-input-help-text-color);
    }

    sl-divider {
        --spacing: var(--sl-spacing-2x-small);
    }
`;

/**
 * Base of the diagram settings menus, with switches and number inputs for the diagram's `settings`.
 * Each change is emitted as a "settings-changed" event with an updated copy of the settings.
 */
export abstract class SettingsMenu<S extends object> extends LitElementWw {

    static styles = [settingsMenuStyles];

    static get scopedElements() {
        return {
            "sl-switch": SlSwitch,
            "sl-input": SlInput,
            "sl-divider": SlDivider
        };
    }

    abstract settings: S;

    @property() accessor diagramType: string = '';

    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    protected _updateSetting<K extends keyof S>(key: K, value: S[K]) {
        const updatedSettings: S = Object.assign(new (this.settings.constructor as new () => S)(), this.settings, { [key]: value });
        this.dispatchEvent(new CustomEvent('settings-changed', {
            detail: { diagramType: this.diagramType, updatedSettings },
            bubbles: true,
            composed: true
        }));
    }

    protected _renderSwitch(key: keyof S, label: unknown, disabled = false) {
        return html`
            <sl-switch
                size="small"
                ?checked=${this.settings[key] === true}
                ?disabled=${disabled}
                @sl-change=${(e: Event) => this._updateSetting(key, (e.target as SlSwitch).checked as S[keyof S])}
            >
                ${label}
            </sl-switch>
        `;
    }

    protected _renderNumberInput(key: keyof S, label: string, min: number) {
        return html`
            <sl-input
                type="number"
                label=${label}
                size="small"
                min=${min}
                .value=${String(this.settings[key])}
                @sl-change=${(e: Event) => {
                    const value = parseInt((e.target as SlInput).value);
                    // An invalid value re-renders the input with the current setting
                    this._updateSetting(key, (isNaN(value) ? this.settings[key] : value) as S[keyof S]);
                }}
            ></sl-input>
        `;
    }

    protected _renderValidationSection(groups: [keyof S, string][][]) {
        const disabled = this.globalSettings.validationMode !== 'custom';
        return html`
            <section class="section">
                <h3 class="section-heading">${msg("Validation")}</h3>
                ${disabled ? html`
                    <p class="help-text">${msg("Set the validation mode to “Custom” to configure individual rules.")}</p>
                ` : ''}
                ${groups.filter(rules => rules.length > 0).map((rules, i) => html`
                    ${i > 0 ? html`<sl-divider></sl-divider>` : ''}
                    ${rules.map(([key, label]) => this._renderSwitch(key, label, disabled))}
                `)}
            </section>
        `;
    }
}
