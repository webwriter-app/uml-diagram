import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlDivider, SlIconButton, SlTooltip } from "@shoelace-style/shoelace";
import zoomIn from "@tabler/icons/outline/zoom-in.svg";
import zoomOut from "@tabler/icons/outline/zoom-out.svg";
import maximizeIcon from "@tabler/icons/outline/arrows-maximize.svg";
import minimizeIcon from "@tabler/icons/outline/arrows-minimize.svg";
import fitIcon from "@tabler/icons/outline/focus-centered.svg";
import styles from "./zoom-controls.styles";

/**
 * Floating zoom and fullscreen controls shared by the diagram editors.
 * Emits "zoom-in", "zoom-out" and "fit-to-view" for the editor to handle, and a bubbling,
 * composed "toggle-fullscreen" that is handled by the main widget.
 */
@localized()
export class ZoomControls extends LitElementWw {

    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-divider": SlDivider,
            "sl-icon-button": SlIconButton,
            "sl-tooltip": SlTooltip
        };
    }

    /** Styles are defined in the corresponding .styles file */
    static styles = [styles];

    /** Current zoom factor and its limits (1 = 100%) */
    @property({ type: Number }) accessor zoomLevel: number = 1;
    @property({ type: Number }) accessor minZoom: number = 0.3;
    @property({ type: Number }) accessor maxZoom: number = 3;

    @property({ type: Boolean }) accessor isFullscreen: boolean = false;

    /** Disables the zoom and fit buttons, e.g. while the canvas is empty */
    @property({ type: Boolean }) accessor zoomDisabled: boolean = false;

    render() {
        const atMin = this.zoomDisabled || this.zoomLevel <= this.minZoom * 1.001;
        const atMax = this.zoomDisabled || this.zoomLevel >= this.maxZoom * 0.999;

        return html`
            <sl-tooltip content=${msg("Toggle Fullscreen")} hoist>
                <sl-icon-button
                    src=${this.isFullscreen ? minimizeIcon : maximizeIcon}
                    label="${msg("Toggle Fullscreen")}"
                    @click=${() => this._emit('toggle-fullscreen', true)}
                ></sl-icon-button>
            </sl-tooltip>
            <sl-tooltip content=${msg("Fit to view")} hoist>
                <sl-icon-button
                    src=${fitIcon}
                    label="${msg("Fit to view")}"
                    ?disabled=${this.zoomDisabled}
                    @click=${() => this._emit('fit-to-view')}
                ></sl-icon-button>
            </sl-tooltip>
            <sl-divider vertical></sl-divider>
            <sl-tooltip content=${msg("Zoom Out")} hoist>
                <sl-icon-button
                    src=${zoomOut}
                    label="${msg("Zoom Out")}"
                    ?disabled=${atMin}
                    @click=${() => this._emit('zoom-out')}
                ></sl-icon-button>
            </sl-tooltip>
            <span class="zoom-level">${Math.round(this.zoomLevel * 100)}%</span>
            <sl-tooltip content=${msg("Zoom In")} placement="top-end" hoist>
                <sl-icon-button
                    src=${zoomIn}
                    label="${msg("Zoom In")}"
                    ?disabled=${atMax}
                    @click=${() => this._emit('zoom-in')}
                ></sl-icon-button>
            </sl-tooltip>
        `;
    }

    /** Dispatch a control event, optionally leaving the editor's shadow root */
    private _emit(name: string, composed: boolean = false) {
        this.dispatchEvent(new CustomEvent(name, { bubbles: composed, composed }));
    }
}
