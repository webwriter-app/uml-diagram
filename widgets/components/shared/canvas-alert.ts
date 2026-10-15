import { css, html, PropertyValues } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { LitElementWw } from "@webwriter/lit";
import { property, state } from "lit/decorators.js";
import { SlAlert, SlIcon } from "@shoelace-style/shoelace";
import alertCircleIcon from "@tabler/icons/outline/alert-circle.svg";
import infoCircleIcon from "@tabler/icons/outline/info-circle.svg";

/**
 * Compact alert at the bottom of an editor canvas: a `hint` while placing an element (e.g. "Select a lifeline"),
 * or an error passed to `show()`, which takes precedence. Closing the hint emits "hint-closed".
 */
export class CanvasAlert extends LitElementWw {

    static get scopedElements() {
        return {
            "sl-alert": SlAlert,
            "sl-icon": SlIcon
        };
    }

    static styles = css`

        /* Positioned via the host, since sl-alert itself is display: contents */
        :host {
            position: absolute;
            bottom: var(--sl-spacing-x-small);
            left: 50%;
            transform: translateX(-50%);
            z-index: 999;
            width: max-content;
            /* leaves room for the zoom controls (about 10rem wide) on both sides */
            max-width: calc(100% - 2 * (10rem + 2 * var(--sl-spacing-x-small)));
        }

        sl-alert::part(base) {
            border-top-width: var(--sl-panel-border-width);
            border-top-color: var(--sl-panel-border-color);
            box-shadow: var(--sl-shadow-medium);
        }

        sl-alert::part(icon) {
            font-size: var(--sl-font-size-medium);
            padding-inline-start: var(--sl-spacing-small);
        }

        sl-alert::part(message) {
            padding: var(--sl-spacing-x-small) var(--sl-spacing-small);
        }

        sl-alert::part(close-button) {
            padding-inline-end: var(--sl-spacing-2x-small);
        }

        .error-text {
            white-space: pre-line;
        }
    `;

    /** Hint shown while no error is; null hides it */
    @property({ attribute: false }) accessor hint: unknown = null;

    @state() private accessor _error: string | null = null;

    /** Re-keys the error alert, so that showing an error restarts its timeout */
    @state() private accessor _errorCount = 0;

    /** Shows an error for 5 seconds */
    public async show(message: string) {
        this._error = message;
        this._errorCount++;
        await this.updateComplete;
        this.shadowRoot?.querySelector<SlAlert>("sl-alert")?.show();
    }

    /** Starting an interaction clears the previous error. */
    protected willUpdate(changed: PropertyValues<this>) {
        if (changed.has("hint") && changed.get("hint") == null && this.hint != null) {
            this._error = null;
        }
    }

    render() {
        if (this._error) {
            return keyed(this._errorCount, html`
                <sl-alert
                    variant="danger"
                    duration="5000"
                    closable
                    @sl-after-hide=${(e: Event) => { if (e.target === e.currentTarget) this._error = null; }}
                >
                    <sl-icon slot="icon" src=${alertCircleIcon}></sl-icon>
                    <span class="error-text">${this._error}</span>
                </sl-alert>
            `);
        }
        if (this.hint != null) {
            return html`
                <sl-alert
                    variant="primary"
                    closable
                    open
                    @sl-hide=${(e: Event) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent("hint-closed")); }}
                >
                    <sl-icon slot="icon" src=${infoCircleIcon}></sl-icon>
                    <span>${this.hint}</span>
                </sl-alert>
            `;
        }
        return null;
    }
}
