import { LitElementWw } from "@webwriter/lit";
import { html, svg } from "lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlButton, SlDropdown, SlMenu, SlMenuItem, SlMenuLabel, SlDivider, SlIcon, SlTooltip } from "@shoelace-style/shoelace";
import trashIcon from "@tabler/icons/outline/trash.svg";
import lifelinePlusIcon from "../../../../../assets/icons/lifeline-plus.svg";
import activationPlusIcon from "../../../../../assets/icons/activation-plus.svg";
import fragmentPlusIcon from "../../../../../assets/icons/fragment-plus.svg";
import messagePlusIcon from "../../../../../assets/icons/message-plus.svg";
import { SequenceSettings } from "../../models/sequence-settings-model";
import { SequenceModel } from "../../models/sequence-model";
import toolbarStyles from "../../../shared/toolbar.styles";
import { closeOtherDropdowns } from "../../../shared/toolbar-dropdowns";

/** Toolbar for the sequence diagram */
@localized()
export class SequenceToolbar extends LitElementWw {
  /** register all used elements */
  static get scopedElements() {
    return {
      "sl-button": SlButton,
      "sl-dropdown": SlDropdown,
      "sl-menu": SlMenu,
      "sl-menu-item": SlMenuItem,
      "sl-menu-label": SlMenuLabel,
      "sl-divider": SlDivider,
      "sl-icon": SlIcon,
      "sl-tooltip": SlTooltip
    };
  }

  /** styles are shared with the class/object toolbar */
  static styles = [toolbarStyles];

  /** Property to get the current state of the diagram */
  @property({ type: Object }) accessor model: SequenceModel = new SequenceModel();

  /** Property to receive the settings from the main widget */
  @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

  /** send an event to inform the container to add a new object/lifeline */
  private _handleAddLifeline() {
      this.dispatchEvent(new CustomEvent("add-lifeline", { bubbles: true, composed: true }));
  }

  /** send an event to inform the container to add a new activation bar */
  private _handleAddActivation() {
        this.dispatchEvent(new CustomEvent('add-activation', { bubbles: true, composed: true }));
    }

  /** send an event to inform the container to add a new Message */
  private _handleAddMessageMode(type: 'sync' | 'async' | 'reply' | 'create-existing' | 'create-new' | 'destroy' | 'found' | 'lost') {
      this.dispatchEvent(new CustomEvent("add-message-mode", { 
          detail: { messageType: type },
          bubbles: true, 
          composed: true 
      }));
  }

  /** send an event to inform the container to add a new Fragment */
  private _handleAddFragmentMode(type: 'alt' | 'opt' | 'loop') {
      this.dispatchEvent(new CustomEvent("add-fragment-mode", { 
          detail: { type: type },
          bubbles: true, 
          composed: true 
      }));
  }

  /** send an event to inform the container to clear the editor */
  private _handleClear() {
      this.dispatchEvent(new CustomEvent("clear-diagram", { bubbles: true, composed: true }));
  }

  /** renders a small SVG icon for the different message types, drawn like the relation icons of the class toolbar */
  private _renderMessageIcon(type: string) {
    const s = "currentColor";
    const w = 1.5;

    // arrow heads as in the relation icons: open for async/reply/create, filled for the others
    const headOpen = (x: number) => svg`<path d="M ${x} 3 L ${x + 8} 7 L ${x} 11" fill="none" stroke="${s}" stroke-width="${w}" />`;
    const headFilled = (x: number) => svg`<path d="M ${x} 3 L ${x + 8} 7 L ${x} 11 Z" fill="${s}" stroke="${s}" stroke-width="${w}" />`;
    // message line, dashed for reply/create
    const line = (x1: number, x2: number, dashed = false) => svg`<line x1="${x1}" y1="7" x2="${x2}" y2="7" stroke="${s}" stroke-width="${w}" stroke-dasharray="${dashed ? "4,2" : "none"}" />`;
    // found/lost dot, destroy cross and the head of the lifeline a create message points to
    const dot = (cx: number) => svg`<circle cx="${cx}" cy="7" r="2.5" fill="${s}" />`;
    const cross = (cx: number) => svg`<path d="M ${cx - 3} 4 L ${cx + 3} 10 M ${cx - 3} 10 L ${cx + 3} 4" fill="none" stroke="${s}" stroke-width="${w}" />`;
    const lifelineHead = (x: number) => svg`<rect x="${x}" y="3" width="8" height="8" fill="none" stroke="${s}" stroke-width="${w}" />`;

    let content;
    switch (type) {
      case 'sync':
        content = svg`${line(0, 26)}${headFilled(26)}`; break;
      case 'async':
        content = svg`${line(0, 26)}${headOpen(26)}`; break;
      case 'reply':
        content = svg`${line(0, 26, true)}${headOpen(26)}`; break;
      case 'create-existing':
      case 'create-new':
        content = svg`${line(0, 17, true)}${headOpen(17)}${lifelineHead(26.25)}`; break;
      case 'destroy':
        content = svg`${line(0, 18)}${headFilled(18)}${cross(31)}`; break;
      case 'found':
        content = svg`${dot(2.5)}${line(2.5, 26)}${headFilled(26)}`; break;
      case 'lost':
        content = svg`${line(0, 19)}${headFilled(19)}${dot(31.5)}`; break;
      default: return html``;
    }

    return svg`
      <svg width="35" height="14" viewBox="0 0 35 14" style="vertical-align: middle;">
        ${content}
      </svg>
    `;
  }

  render() {
    return html`
      <div class="toolbar-container" @sl-show=${closeOtherDropdowns}>
        <div class="actions">
            <sl-tooltip
                content=${msg("Max. number of objects reached")}
                ?disabled=${this.model?.lifelines?.length < this.settings.maxNumberOfLifelines}
                hoist
            >
                <sl-button 
                    size="small"
                    @click=${this._handleAddLifeline}
                    ?disabled=${(this.model?.lifelines?.length) >= this.settings.maxNumberOfLifelines}
                >
                    <sl-icon slot="prefix" src=${lifelinePlusIcon}></sl-icon>
                    ${msg("Lifeline")}
                </sl-button>
            </sl-tooltip>

            ${this.settings.activationExists ? html`
                <sl-tooltip
                    content=${msg("Max. number of activations reached")}
                    ?disabled=${this.model.lifelines.reduce((sum, ll) => sum + (ll.activations?.length || 0), 0) < this.settings.maxNumberOfActivations}
                    hoist
                >
                    <sl-button 
                        size="small"
                        @click=${this._handleAddActivation}
                        ?disabled=${this.model.lifelines.reduce((sum, ll) => sum + (ll.activations?.length || 0), 0) >= this.settings.maxNumberOfActivations}
                    >
                        <sl-icon slot="prefix" src=${activationPlusIcon}></sl-icon>
                        ${msg("Activation")}
                    </sl-button>
                </sl-tooltip>
            ` : ''}

            <sl-tooltip
                content=${msg("Max. number of fragments reached")}
                ?disabled=${this.model?.fragments?.length < this.settings.maxNumberOfFragments}
                hoist
            >
                <sl-dropdown placement="bottom-start" hoist>
                    <sl-button 
                        size="small"
                        slot="trigger" 
                        caret 
                        ?disabled=${(this.model?.fragments?.length) >= this.settings.maxNumberOfFragments}
                    >
                        <sl-icon slot="prefix" src=${fragmentPlusIcon}></sl-icon>
                        ${msg("Fragment")}
                    </sl-button>
                    <sl-menu class="toolbar-menu" style="width: 200px;">
                        ${this.settings.alternativeFragmentExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddFragmentMode('alt')}>
                                ${msg("Alternative")} (alt)
                            </sl-menu-item>
                        ` : ''}

                        ${this.settings.optionalFragmentExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddFragmentMode('opt')}>
                                ${msg("Optional")} (opt)
                            </sl-menu-item>
                        ` : ''}

                        ${this.settings.loopFragmentExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddFragmentMode('loop')}>
                                ${msg("Loop")} (loop)
                            </sl-menu-item>
                        ` : ''}
                    </sl-menu>
                </sl-dropdown>
            </sl-tooltip>
            
            <sl-tooltip
                content=${msg("Max. number of messages reached")}
                ?disabled=${this.model?.messages?.length < this.settings.maxNumberOfMessages}
                hoist
            >
                <sl-dropdown placement="bottom-start" hoist>
                    <sl-button 
                        size="small"
                        slot="trigger" 
                        caret 
                        ?disabled=${(this.model?.messages?.length) >= this.settings.maxNumberOfMessages}
                    >
                        <sl-icon slot="prefix" src=${messagePlusIcon}></sl-icon>
                        ${msg("Message")}
                    </sl-button>
                    <sl-menu class="toolbar-menu" style="width: 250px;">
                        ${(this.settings.synchronousMessageExists || this.settings.asynchronousMessageExists || this.settings.replyMessageExists) ? html`
                            <sl-menu-label>${msg("Calls & Replies")}</sl-menu-label>

                            ${this.settings.synchronousMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('sync')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('sync')}</div>
                                    ${msg("Synchronous")}
                                </sl-menu-item>
                            ` : ''}

                            ${this.settings.asynchronousMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('async')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('async')}</div>
                                    ${msg("Asynchronous")}
                                </sl-menu-item>
                            ` : ''}

                            ${this.settings.replyMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('reply')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('reply')}</div>
                                    ${msg("Reply (Return)")}
                                </sl-menu-item>
                            ` : ''}
                        ` : ''}

                        ${(this.settings.createMessageExists || this.settings.destroyMessageExists) ? html`
                            <sl-divider></sl-divider>
                            <sl-menu-label>${msg("Object Lifecycle")}</sl-menu-label>

                            ${this.settings.createMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('create-existing')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('create-existing')}</div>
                                    ${msg("Create (Existing Object)")}
                                </sl-menu-item>
                            ` : ''}

                            ${this.settings.createMessageExists && (this.model?.lifelines?.length) < this.settings.maxNumberOfLifelines ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('create-new')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('create-new')}</div>
                                    ${msg("Create (New Object)")}
                                </sl-menu-item>
                            ` : ''}

                            ${this.settings.destroyMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('destroy')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('destroy')}</div>
                                    ${msg("Destroy")}
                                </sl-menu-item>
                            ` : ''}
                        ` : ''}

                        ${(this.settings.foundMessageExists || this.settings.lostMessageExists) ? html`
                            <sl-divider></sl-divider>
                            <sl-menu-label>${msg("Found & Lost")}</sl-menu-label>

                            ${this.settings.foundMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('found')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('found')}</div>
                                    ${msg("Found")}
                                </sl-menu-item>
                            ` : ''}

                            ${this.settings.lostMessageExists ? html`
                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('lost')}>
                                    <div slot="prefix" style="display: flex; align-items: center;">${this._renderMessageIcon('lost')}</div>
                                    ${msg("Lost")}
                                </sl-menu-item>
                            ` : ''}
                        ` : ''}
                    </sl-menu>
                </sl-dropdown>
            </sl-tooltip>
        </div>

        <sl-tooltip content=${msg("Reset diagram")} hoist>
            <sl-button class="clear-btn" size="small" @click=${this._handleClear}>
                <sl-icon src=${trashIcon} label=${msg("Reset diagram")}></sl-icon>
            </sl-button>
        </sl-tooltip>
      </div>
    `;
  }
}