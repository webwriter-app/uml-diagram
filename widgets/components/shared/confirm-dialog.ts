import { css, html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { query, state } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlButton, SlDialog } from "@shoelace-style/shoelace";

export interface ConfirmOptions {
    label: string;
    message: string;
    confirmLabel: string;
}

/** Confirmation for the toolbar's reset button, which either returns to the checkpoint or clears the diagram */
export function resetDiagramConfirmOptions(toCheckpoint: boolean): ConfirmOptions {
    return toCheckpoint
        ? { label: msg("Reset diagram"), message: msg("Do you really want to return to the starting point?"), confirmLabel: msg("Reset") }
        : { label: msg("Clear diagram"), message: msg("Do you really want to clear the diagram?"), confirmLabel: msg("Clear") };
}

/**
 * In-widget replacement for the browser's confirm() box, shown over the editor canvas.
 * Emits bubbling, composed "dialog-opened" and "dialog-closed" events like the other dialogs.
 */
@localized()
export class ConfirmDialog extends LitElementWw {

    static get scopedElements() {
        return {
            "sl-button": SlButton,
            "sl-dialog": SlDialog
        };
    }

    static styles = css`
        sl-dialog {
            --width: 26rem;
        }

        /* Binds the dialog to the editor instead of the document */
        sl-dialog::part(base) {
            position: absolute;
            height: 100%;
        }

        sl-dialog::part(overlay) {
            position: absolute;
        }

        sl-dialog::part(body) {
            padding-top: 0;
        }
    `;

    @query("sl-dialog") accessor dialog!: SlDialog;

    @state() private accessor _options: ConfirmOptions = { label: "", message: "", confirmLabel: "" };

    /** Resolves the pending confirm() call; null if no request is open */
    private _resolve: ((confirmed: boolean) => void) | null = null;

    /** Answer to the current request; Escape and the close button leave it at false */
    private _confirmed = false;

    /** Opens the dialog and resolves to true if the user confirms, false if they cancel or dismiss it */
    public confirm(options: ConfirmOptions): Promise<boolean> {
        this._resolve?.(false);
        this._options = options;
        this._confirmed = false;
        this.dialog.show();
        return new Promise(resolve => this._resolve = resolve);
    }

    private _close(confirmed: boolean) {
        this._confirmed = confirmed;
        this.dialog.hide();
    }

    render() {
        return html`
            <sl-dialog
                label=${this._options.label}
                @sl-show=${(e: Event) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('dialog-opened', { bubbles: true, composed: true })); }}
                @sl-hide=${(e: Event) => { if (e.target === e.currentTarget) { this._resolve?.(this._confirmed); this._resolve = null; } }}
                @sl-after-hide=${(e: Event) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('dialog-closed', { bubbles: true, composed: true })); }}
            >
                ${this._options.message}
                <sl-button slot="footer" @click=${() => this._close(false)}>${msg("Cancel")}</sl-button>
                <sl-button slot="footer" variant="danger" @click=${() => this._close(true)}>${this._options.confirmLabel}</sl-button>
            </sl-dialog>
        `;
    }
}
