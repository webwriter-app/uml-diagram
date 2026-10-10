import { html } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { GlobalSettings } from "../global-settings/global-settings-model";
import styles from "./diagram-tabs.styles";

/** Diagram types in tab order */
const DIAGRAM_TYPES = ["class-diagram", "object-diagram", "sequence-diagram"] as const;

/** The diagram types that get a tab: all enabled ones, plus the active one even if it was disabled */
export function visibleDiagramTypes(globalSettings: GlobalSettings, active: string): string[] {
    const enabled: Record<string, boolean> = {
        "class-diagram": globalSettings.classDiagramEnabled,
        "object-diagram": globalSettings.objectDiagramEnabled,
        "sequence-diagram": globalSettings.sequenceDiagramEnabled,
    };
    return DIAGRAM_TYPES.filter(type => enabled[type] || type === active);
}

/**
 * Row of tabs to switch between the enabled diagram types, shown on top of the widget.
 * Emits a "select-diagram" event with the chosen diagram type in `detail.type`.
 */
@localized()
export class DiagramTabs extends LitElementWw {

    /** Styles are defined in the corresponding .styles file */
    static styles = [styles];

    /** The currently shown diagram type */
    @property({ type: String }) accessor active: string = "class-diagram";

    /** In fullscreen the tabs sit on the screen edge, so they are drawn without rounded corners */
    @property({ type: Boolean, reflect: true }) accessor fullscreen: boolean = false;

    /** Global settings, used to only show the enabled diagram types */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    connectedCallback() {
        super.connectedCallback();
        this.setAttribute("role", "tablist");
    }

    render() {
        const labels: Record<string, string> = {
            "class-diagram": msg("Class Diagram"),
            "object-diagram": msg("Object Diagram"),
            "sequence-diagram": msg("Sequence Diagram"),
        };

        return visibleDiagramTypes(this.globalSettings, this.active).map(type => html`
            <button
                class="tab ${type === this.active ? 'active' : ''}"
                role="tab"
                aria-selected=${type === this.active ? 'true' : 'false'}
                @click=${() => this._select(type)}
            >${labels[type]}</button>
        `);
    }

    /** Notify the widget that another diagram type was chosen */
    private _select(type: string) {
        if (type === this.active) return;
        this.dispatchEvent(new CustomEvent("select-diagram", { detail: { type } }));
    }
}
