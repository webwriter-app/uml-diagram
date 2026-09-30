import { html, svg } from "lit";
import { LitElementWw } from "@webwriter/lit";
import { property } from "lit/decorators.js";
import { msg, localized } from "@lit/localize";
import { ClassSettings } from "../../models/class-settings-model";
import toolbarStyles from "../../../shared/toolbar.styles";
import styles from "./class-toolbar.styles";
import classPlusIcon from "../../../../../assets/icons/class-plus.svg";
import objectPlusIcon from "../../../../../assets/icons/object-plus.svg";
import relationPlusIcon from "../../../../../assets/icons/relation-plus.svg";
import trashIcon from "@tabler/icons/outline/trash.svg";
import { SlButton, SlDivider, SlMenu, SlMenuItem, SlMenuLabel, SlDropdown, SlIcon, SlTooltip } from "@shoelace-style/shoelace";

/** 
 * This file defines the toolbars for the class- and object- diagram
 * It changes depending on the current diagram type
 * The toolbar holds a set of options to add elements to the current diagram
 * */
@localized()
export class ClassToolbar extends LitElementWw{
    /** Register used Elements */
    static get scopedElements() {
        return {
            "sl-button": SlButton,
            "sl-divider": SlDivider,
            "sl-icon": SlIcon,
            "sl-menu": SlMenu,
            "sl-menu-item": SlMenuItem,
            "sl-dropdown": SlDropdown,
            "sl-menu-label": SlMenuLabel,
            "sl-tooltip": SlTooltip
        };
    }

    /** Styles are definied in the corespondig file ./class-toolbar.styles.ts */
    static styles = [toolbarStyles, styles];

    /** Property to hold the current diagram type passed down by the widget */
    @property() accessor diagramType: string = "class-diagram";

    /** Property to hold the passed down settings for the diagram */
    @property({ attribute: false }) accessor settings: ClassSettings = ClassSettings.getInitialClassDiagramSettings();

    /** Property to hold the current number of classes/objects passed down by the container*/
    @property({ type: Number }) accessor currentClassCount: number = 0;

    /** Property to hold the current number of relations/links passed down by the container */
    @property({ type: Number }) accessor currentRelationCount: number = 0;

    /** Property to inform the toolbar that a dialog is opend to deactivate it */
    @property({ type: Boolean, reflect: true }) accessor dialogOpen: boolean = false;

    // --------------------------------------------------------------------------------------------------------
    // Handlers to dispatch events
    // --------------------------------------------------------------------------------------------------------

    /** Dispatch an evnet to tell the widget to add a new relation */
    private _sendRelation(type: string) {
        this.dispatchEvent(
            new CustomEvent(`addRelation`, {
                detail: { type },
                bubbles: true,
                composed: true,
            })
        );
    }

    /** Dispatch an event to tell the widget to add a new class or object */
    private _sendClass(type: string) {
        if (this.diagramType === "class-diagram") {
            this.dispatchEvent(
                new CustomEvent('addClass', {
                    detail: { type },
                    bubbles: true,
                    composed: true,
                })
            );
        } else {
            this.dispatchEvent(
                new CustomEvent('addObject', {
                    detail: { type },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // rendering and rendering helper methods
    // --------------------------------------------------------------------------------------------------------

    /** renders a small SVG icon for the different relation types add buttons */
    private _renderRelationIcon(type: string) {
        const s = "currentColor"; 
        const w = 1.5;            
        
        // define different arrowheads
        const arrowRight = svg`<path d="M 26 3 L 34 7 L 26 11" fill="none" stroke="${s}" stroke-width="${w}" />`;
        const arrowLeft = svg`<path d="M 9 3 L 1 7 L 9 11" fill="none" stroke="${s}" stroke-width="${w}" />`;
        const triangleEmpty = svg`<path d="M 24 2 L 34 7 L 24 12 Z" fill="none" stroke="${s}" stroke-width="${w}" />`;
        const diamondEmpty = svg`<path d="M 20 7 L 27 3 L 34 7 L 27 11 Z" fill="none" stroke="${s}" stroke-width="${w}" />`;
        const diamondFilled = svg`<path d="M 20 7 L 27 3 L 34 7 L 27 11 Z" fill="${s}" stroke="${s}" stroke-width="${w}" />`;


        // define different Arrowlines
        const lineToArrow = svg`<line x1="0" y1="7" x2="26" y2="7" stroke="${s}" stroke-width="${w}" />`;
        const lineToArrowDashed = svg`<line x1="0" y1="7" x2="26" y2="7" stroke="${s}" stroke-width="${w}" stroke-dasharray="4,2" />`;
        const lineToTriangle = svg`<line x1="0" y1="7" x2="24" y2="7" stroke="${s}" stroke-width="${w}" />`;
        const lineToTriangleDashed = svg`<line x1="0" y1="7" x2="24" y2="7" stroke="${s}" stroke-width="${w}" stroke-dasharray="4,2" />`;
        const lineToDiamond = svg`<line x1="0" y1="7" x2="20" y2="7" stroke="${s}" stroke-width="${w}" />`;
        const lineBiDir = svg`<line x1="9" y1="7" x2="26" y2="7" stroke="${s}" stroke-width="${w}" />`;
        const lineFull = svg`<line x1="0" y1="7" x2="35" y2="7" stroke="${s}" stroke-width="${w}" />`;

        // combines arrowlines and heads depending on relation type
        let content;
        switch (type) {
            case 'association': 
                content = svg`${lineToArrow}${arrowRight}`; break;
            case 'association-bidirectional':
                content = svg`${arrowLeft}${lineBiDir}${arrowRight}`; break;
            case 'association-undirected':
                content = svg`${lineFull}`; break; 
            case 'inheritance':
                content = svg`${lineToTriangle}${triangleEmpty}`; break;
            case 'realization':
                content = svg`${lineToTriangleDashed}${triangleEmpty}`; break;
            case 'dependency':
                content = svg`${lineToArrowDashed}${arrowRight}`; break;
            case 'aggregation':
                content = svg`${lineToDiamond}${diamondEmpty}`; break;
            case 'composition':
                content = svg`${lineToDiamond}${diamondFilled}`; break; 
            default: return html``;
        }

        // returns compound arrow
        return svg`
            <svg width="35" height="14" viewBox="0 0 35 14" style="vertical-align: middle;">
                ${content}
            </svg>
        `;
    }

    /** Defines the render method of the toolbar */
    render() {
        const isObjectDiagram = this.diagramType === 'object-diagram';

        return html`
            <div class="toolbar-container">
                <div class="actions">
                    ${isObjectDiagram 
                        ? html`
                            <sl-tooltip
                                content=${msg("Max. number of objects reached")}
                                ?disabled=${this.currentClassCount < this.settings.maxClasses}
                                hoist
                            >
                                <sl-button 
                                    size="small"
                                    @click=${() => this._sendClass("object")}
                                    ?disabled=${this.currentClassCount >= this.settings.maxClasses}
                                >
                                    <sl-icon slot="prefix" src=${objectPlusIcon}></sl-icon>
                                    ${msg("Object")}
                                </sl-button>
                            </sl-tooltip>
                        ` 
                        : html`
                            <sl-tooltip
                                content=${msg("Max. number of classes reached")}
                                ?disabled=${this.currentClassCount < this.settings.maxClasses}
                                hoist
                            >
                                <div>
                                    <sl-dropdown placement="bottom-start" hoist>
                                        <sl-button 
                                            size="small"
                                            slot="trigger" 
                                            caret
                                            ?disabled=${this.currentClassCount >= this.settings.maxClasses}
                                        >
                                            <sl-icon slot="prefix" src=${classPlusIcon}></sl-icon>
                                            ${msg("Class")}
                                        </sl-button>

                                        <sl-menu class="toolbar-menu" style="width: 250px;" hoist>
                                            ${ (this.settings.standardExists || this.settings.abstractExists || this.settings.parameterizedExists) ? html`
                                                <sl-menu-label class="toolbar-menu-label">${msg("Classes:")}</sl-menu-label>
                                                <sl-divider class="toolbar-divider"></sl-divider>
                                                ${this.settings.standardExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("standard")}>${msg("Class")}</sl-menu-item>` : ''}
                                                ${this.settings.abstractExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("abstract")}>${msg("Abstract Class")}</sl-menu-item>` : ''}
                                                ${this.settings.parameterizedExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("param-class")}>${msg("Parameterized Class")}</sl-menu-item>` : ''}
                                            ` : '' }

                                            ${ (this.settings.interfaceExists || this.settings.annotationExists) ? html`
                                                <sl-divider class="toolbar-divider"></sl-divider>
                                                <sl-menu-label class="toolbar-menu-label">${msg("Interfaces & Metadata:")}</sl-menu-label>
                                                <sl-divider></sl-divider>
                                                ${this.settings.interfaceExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("interface")}>${msg("Interface")}</sl-menu-item>` : ''}
                                                ${this.settings.annotationExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("annotation")}>${msg("Annotation")}</sl-menu-item>` : ''}
                                            ` : '' }

                                            ${ (this.settings.recordExists || this.settings.dataTypeExists || this.settings.enumExists) ? html`
                                                <sl-divider class="toolbar-divider"></sl-divider>
                                                <sl-menu-label class="toolbar-menu-label">${msg("Data Types:")}</sl-menu-label>
                                                <sl-divider></sl-divider>
                                                ${this.settings.recordExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("record")}>${msg("Record")}</sl-menu-item>` : ''}
                                                ${this.settings.dataTypeExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("datatype")}>${msg("DataType")}</sl-menu-item>` : ''}
                                                ${this.settings.enumExists ? html`<sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("enum")}>${msg("Enumeration")}</sl-menu-item>` : ''}
                                            ` : '' }

                                            ${ (this.settings.objectExists) ? html`
                                                <sl-divider class="toolbar-divider"></sl-divider>
                                                <sl-menu-label class="toolbar-menu-label">${msg("Runtime:")}</sl-menu-label>
                                                <sl-divider></sl-divider>
                                                <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendClass("object")}>${msg("Object")}</sl-menu-item>
                                            ` : '' }
                                        </sl-menu>
                                    </sl-dropdown>
                                </div>
                            </sl-tooltip>
                        `
                    }

                    <sl-tooltip
                        content=${msg("Max. number of connections reached")}
                        ?disabled=${this.currentRelationCount < this.settings.maxRelations}
                        hoist
                    >
                        <div>
                            <sl-dropdown placement="bottom-start" hoist>
                                <sl-button 
                                    size="small"
                                    slot="trigger" 
                                    caret
                                    ?disabled=${this.currentRelationCount >= this.settings.maxRelations}
                                >
                                    <sl-icon slot="prefix" src=${relationPlusIcon}></sl-icon>
                                    ${isObjectDiagram ? msg("Link") : msg("Relation")}
                                </sl-button>
                                
                                <sl-menu class="toolbar-menu" style="width: 250px;" hoist>
                                    
                                    ${ (this.settings.associationExists || this.settings.associationBidirectionalExists || this.settings.associationUndirectedExists) ? html`
                                        <sl-menu-label class="toolbar-menu-label">${isObjectDiagram ? msg("Links") : msg("Connections")}</sl-menu-label>
                                        <sl-divider class="toolbar-divider"></sl-divider>
                                        
                                        ${this.settings.associationExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("association")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('association')}</div>
                                                ${isObjectDiagram ? msg("Link (Directed)") : msg("Association (Directed)")}
                                            </sl-menu-item>
                                        ` : ''}

                                        ${this.settings.associationBidirectionalExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("association-bidirectional")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('association-bidirectional')}</div>
                                                ${isObjectDiagram ? msg("Link (Bi-Dir)") : msg("Association (Bi-Dir)")}
                                            </sl-menu-item>
                                        ` : ''}

                                        ${this.settings.associationUndirectedExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("association-undirected")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('association-undirected')}</div>
                                                ${isObjectDiagram ? msg("Link (Undirected)") : msg("Association (Undirected)")}
                                            </sl-menu-item>
                                        ` : ''}
                                    ` : '' }

                                    ${ (!isObjectDiagram && (this.settings.inheritanceExists || this.settings.realizationExists)) ? html`
                                        <sl-divider class="toolbar-divider"></sl-divider>
                                        <sl-menu-label class="toolbar-menu-label">${msg("Generalization")}</sl-menu-label>
                                        <sl-divider></sl-divider>

                                        ${this.settings.inheritanceExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("inheritance")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('inheritance')}</div>
                                                ${msg("Inheritance")}
                                            </sl-menu-item>
                                        ` : ''}

                                        ${this.settings.realizationExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("realization")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('realization')}</div>
                                                ${msg("Realization")}
                                            </sl-menu-item>
                                        ` : ''}
                                    ` : '' }

                                    ${ (!isObjectDiagram && this.settings.dependencyExists) ? html`
                                        <sl-divider class="toolbar-divider"></sl-divider>
                                        <sl-menu-label class="toolbar-menu-label">${msg("Dependencies")}</sl-menu-label>
                                        <sl-divider></sl-divider>

                                        <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("dependency")}>
                                            <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('dependency')}</div>
                                            ${msg("Dependency")}
                                        </sl-menu-item>
                                    ` : '' }

                                    ${ (this.settings.aggregationExists || this.settings.compositionExists) ? html`
                                        <sl-divider class="toolbar-divider"></sl-divider>
                                        <sl-menu-label class="toolbar-menu-label">${msg("Part / Whole")}</sl-menu-label>
                                        <sl-divider></sl-divider>

                                        ${this.settings.aggregationExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("aggregation")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('aggregation')}</div>
                                                ${msg("Aggregation")}
                                            </sl-menu-item>
                                        ` : ''}

                                        ${this.settings.compositionExists ? html`
                                            <sl-menu-item class="toolbar-menu-item" @click=${() => this._sendRelation("composition")}>
                                                <div slot="prefix" style="display: flex; align-items: center;">${this._renderRelationIcon('composition')}</div>
                                                ${msg("Composition")}
                                            </sl-menu-item>
                                        ` : ''}
                                    ` : '' }

                                </sl-menu>
                            </sl-dropdown>
                        </div>
                    </sl-tooltip>
                </div>
                
                <sl-tooltip content=${msg("Reset diagram")} hoist>
                    <sl-button 
                        class="clear-btn" 
                        size="small"
                        @click=${() => this.dispatchEvent(new CustomEvent('clearCanvas', { bubbles: true, composed: true }))}
                    >
                        <sl-icon src=${trashIcon} label=${msg("Reset diagram")}></sl-icon>
                    </sl-button>
                </sl-tooltip>
            </div>
        `;
    }
}