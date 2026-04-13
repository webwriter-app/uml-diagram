import { LitElementWw } from "@webwriter/lit";
import { html } from "lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { SlButton, SlDropdown, SlMenu, SlMenuItem, SlDivider, SlIcon, SlTooltip } from "@shoelace-style/shoelace";
import trashIcon from "@tabler/icons/outline/trash.svg";
import { SequenceSettings } from "../../models/sequence-settings-model";
import { SequenceModel } from "../../models/sequence-model";
import styles from "./sequence-diagram-toolbar.styles";
import { GlobalSettings } from "../../../global-settings/global-settings-model";

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
      "sl-divider": SlDivider,
      "sl-icon": SlIcon,
      "sl-tooltip": SlTooltip
    };
  }

  /** styles are defined in the toolbar.styles file */
  static styles = [styles];

  /** Property to get the current state of the diagram */
  @property({ type: Object }) accessor model: SequenceModel = new SequenceModel();

  /** Property to receive the current diagram type */
  @property({ type: String }) diagramType = "sequence-diagram";

  /** Property to receive the settings from the main widget */
  @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();
  
  /** Property to hold the passed down global settings */
  @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

  /** Property to hold the passed down info if fullscreen is active */
  @property({ type: Boolean }) accessor isFullscreen: boolean = false;

  /** send an event to inform the widget to change the current diagram type */
  private _changeDiagram(type: string) {
    this.dispatchEvent(new CustomEvent("change-diagram-type", { detail: { type }, bubbles: true, composed: true }));
  }

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

  render() {
    return html`
      <div class="toolbar-container ${this.isFullscreen ? 'fullscreen' : ''}">
        <div class="left-section">
            <sl-dropdown hoist>
                <sl-button 
                    class="toolbar-btn" 
                    slot="trigger" 
                    variant="text" 
                    caret
                >
                    ${msg("Sequence Diagram")}
                </sl-button>
                <sl-menu class="toolbar-menu" style="width: 265px;">
                    ${this.globalSettings.classDiagramEnabled ? html`
                        <sl-menu-item class="toolbar-menu-item" @click=${() => this._changeDiagram("class-diagram")}>
                            ${msg("Switch to Class-Diagram")}
                        </sl-menu-item>
                    ` : ''}
                    ${this.globalSettings.objectDiagramEnabled ? html`
                        <sl-divider class="toolbar-divider"></sl-divider>
                        <sl-menu-item class="toolbar-menu-item" @click=${() => this._changeDiagram("object-diagram")}>
                            ${msg("Switch to Object-Diagram")}
                        </sl-menu-item>
                    ` : ''}
                </sl-menu>
            </sl-dropdown>
        </div>

        <div class="center-section">
            <sl-tooltip
                content=${msg("Max. number of objects reached")}
                ?disabled=${this.model?.lifelines?.length < this.settings.maxNumberOfLifelines}
                hoist
            >
                <sl-button 
                    class="toolbar-btn"
                    variant="text" 
                    @click=${this._handleAddLifeline}
                    ?disabled=${(this.model?.lifelines?.length) >= this.settings.maxNumberOfLifelines}
                >
                    ${msg("Add Lifeline")}
                </sl-button>
            </sl-tooltip>

            ${this.settings.activationExists ? html`
                <sl-tooltip
                    content=${msg("Max. number of activations reached")}
                    ?disabled=${this.model.lifelines.reduce((sum, ll) => sum + (ll.activations?.length || 0), 0) < this.settings.maxNumberOfActivations}
                    hoist
                >
                    <sl-button 
                        class="toolbar-btn"
                        variant="text" 
                        @click=${this._handleAddActivation}
                        ?disabled=${this.model.lifelines.reduce((sum, ll) => sum + (ll.activations?.length || 0), 0) >= this.settings.maxNumberOfActivations}
                    >
                        ${msg("Add Activation")}
                    </sl-button>
                </sl-tooltip>
            ` : ''}

            <sl-tooltip
                content=${msg("Max. number of fragments reached")}
                ?disabled=${this.model?.fragments?.length < this.settings.maxNumberOfFragments}
                hoist
            >
                <sl-dropdown hoist>
                    <sl-button 
                        class="toolbar-btn"
                        slot="trigger" 
                        variant="text" 
                        caret 
                        ?disabled=${(this.model?.fragments?.length) >= this.settings.maxNumberOfFragments}
                    >
                        ${msg("Add Fragment")}
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
                <sl-dropdown hoist>
                    <sl-button 
                        class="toolbar-btn"
                        slot="trigger" 
                        variant="text" 
                        caret 
                        ?disabled=${(this.model?.messages?.length) >= this.settings.maxNumberOfMessages}
                    >
                        ${msg("Add Message")}
                    </sl-button>
                    <sl-menu class="toolbar-menu" style="width: 200px;">

                        ${this.settings.synchronousMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('sync')}>
                                ${msg("Synchronous")}
                            </sl-menu-item>
                        ` : ''}

                        ${this.settings.asynchronousMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('async')}>
                                ${msg("Asynchronous")}
                            </sl-menu-item>
                        ` : ''}

                        ${this.settings.replyMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('reply')}>
                                ${msg("Reply (Return)")}
                            </sl-menu-item>
                        ` : ''}

                        <sl-divider class="toolbar-divider"></sl-divider>

                        ${this.settings.createMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('create-existing')}>
                                ${msg("Create (Existing Object)")}
                            </sl-menu-item>
                        ` : ''}

                        ${this.settings.createMessageExists ? html`
                            ${(this.model?.lifelines?.length) < this.settings.maxNumberOfLifelines ? html`
                                <sl-menu-item 
                                    class="toolbar-menu-item"
                                    @click=${() => this._handleAddMessageMode('create-new')}
                                    ?disabled=${(this.model?.lifelines?.length) >= this.settings.maxNumberOfLifelines}
                                >
                                    ${msg("Create (New Object)")}
                                </sl-menu-item>
                            ` : ''}
                        ` : ''}

                        ${this.settings.destroyMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('destroy')}>
                                ${msg("Destroy")}
                            </sl-menu-item>
                        ` : ''}

                        <sl-divider class="toolbar-divider"></sl-divider>

                        ${this.settings.foundMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('found')}>
                                ${msg("Found")}
                            </sl-menu-item>
                        ` : ''}

                        ${this.settings.lostMessageExists ? html`
                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._handleAddMessageMode('lost')}>
                                ${msg("Lost")}
                            </sl-menu-item>
                        ` : ''}
                    </sl-menu>
                </sl-dropdown>
            </sl-tooltip>
        </div>

        <div class="right-section">
            <sl-button class="clear-btn" variant="text" @click=${this._handleClear}>
                <sl-icon slot="prefix" src=${trashIcon}></sl-icon>
            </sl-button>
        </div>
      </div>
    `;
  }
}