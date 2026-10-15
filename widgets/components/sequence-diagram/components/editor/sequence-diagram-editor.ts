import { LitElementWw } from "@webwriter/lit";
import { html, svg } from "lit";
import { property, query, state } from "lit/decorators.js";
import { msg, str, localized } from "@lit/localize";
import interact from 'interactjs';
import { SlButton, SlDrawer, SlInput, SlIcon, SlSelect, SlOption } from "@shoelace-style/shoelace";
import userIcon from '@tabler/icons/outline/user.svg';
import databaseIcon from '@tabler/icons/outline/database.svg';
import serverIcon from '@tabler/icons/outline/server.svg';
import desktopIcon from '@tabler/icons/outline/device-desktop.svg';
import { repeat } from 'lit/directives/repeat.js';
import trashIcon from "@tabler/icons/outline/trash.svg";
import xIcon from "@tabler/icons/outline/x.svg";
import plusIcon from "@tabler/icons/outline/plus.svg";
import mobileIcon from "@tabler/icons/outline/device-mobile.svg";
import noIcon from "@tabler/icons/outline/ban.svg";
import usersIcon from "@tabler/icons/outline/users.svg";
import worldIcon from "@tabler/icons/outline/world.svg";
import cloudIcon from "@tabler/icons/outline/cloud.svg";
import apiIcon from "@tabler/icons/outline/api.svg";
import settingsIcon from "@tabler/icons/outline/settings.svg";
import lockIcon from "@tabler/icons/outline/lock.svg";
import mailIcon from "@tabler/icons/outline/mail.svg";
import fileIcon from "@tabler/icons/outline/file.svg";
import clockIcon from "@tabler/icons/outline/clock.svg";
import creditCardIcon from "@tabler/icons/outline/credit-card.svg";
import { SequenceModel } from "../../models/sequence-model";
import { SequenceSettings } from "../../models/sequence-settings-model";
import { CanvasAlert } from "../../../shared/canvas-alert";
import styles from "./sequence-diagram-editor.styles";
import { GlobalSettings, ValidationIssue } from "../../../global-settings/global-settings-model";
import { arrowMarkers } from "../../../shared/arrow-markers";
import { ZoomControls } from "../../../zoom-controls/zoom-controls";
import { ConfirmDialog, ConfirmOptions } from "../../../shared/confirm-dialog";
import { Pinch, emulateTouchClicks, measurePinch } from "../../../shared/interaction";

/** icon map to ease the use of them */
const iconMap: Record<string, string> = {
    'user': userIcon,
    'users': usersIcon,
    'device-desktop': desktopIcon,
    'device-mobile': mobileIcon,
    'world': worldIcon,
    'server': serverIcon,
    'cloud': cloudIcon,
    'database': databaseIcon,
    'api': apiIcon,
    'settings': settingsIcon,
    'lock': lockIcon,
    'mail': mailIcon,
    'file': fileIcon,
    'clock': clockIcon,
    'credit-card': creditCardIcon
};

/** Leave space below object headers and above lifeline ends. */
const LIFELINE_PADDING = 20;
const MIN_LIFELINE_LENGTH = 80 + 2 * LIFELINE_PADDING;

/** Interactive editor for the Sequence Diagram */
@localized()
export class SequenceEditor extends LitElementWw {

    /** register used elements */
    static get scopedElements() {
        return {
            "sl-button": SlButton,
            "sl-drawer": SlDrawer, 
            "sl-input": SlInput,
            "sl-icon": SlIcon,
            "sl-select": SlSelect,
            "sl-option": SlOption,
            "zoom-controls": ZoomControls,
            "confirm-dialog": ConfirmDialog,
            "canvas-alert": CanvasAlert
        };
    }

    /** Property to collectively store the state of the diagram */
    @property({ type: Object }) accessor model: SequenceModel = new SequenceModel();

    /** State to store the id of the currently edited Fragment */
    @state() accessor editingFragmentId: string | null = null;
    
    /** State to store the current interaction mode (idle for default or what should be selected)*/
    @property({ type: String, reflect: true }) accessor interactionMode: 'idle' | 'add-message-source' | 'add-message-target' | 'add-activation' | 'creating-fragment-start' | 'creating-fragment-end' = 'idle';
    
    /** Store the source id of a new message while creating a new one */
    @property({ type: String }) accessor messageSourceId: string | null = null;

    /** Store the id of the lifeline a new fragment starts at while creating a new one */
    @property({ type: String }) accessor fragmentSourceId: string | null = null;

    /** State to store the id of the current edited lifeline */
    @state() private accessor editingLifelineId: string | null = null;

    /**
     * The drag in progress (moving/resizing an element or panning the view): the id of the dragged element
     * (null while panning) and the cursor to show. While set, the dragged element stays highlighted,
     * other elements show no hover state and the cursor stays the same everywhere.
     */
    @state() private accessor _activeDrag: { id: string | null, cursor: string } | null = null;

    /** State to store the id of the current edited activation bar */
    @state() private accessor editingActivation: { lifelineId: string, id: string } | null = null;

    /** Property to receive the settings from the main widget */
    @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();
    
    /** Store the type of the message while creating a new one */
    @property({ type: String }) accessor pendingMessageType: string = 'sync';

    /** State to store the id of the current edited message*/
    @state() private accessor editingMessageId: string | null = null;

    /** stores fields that already were in fokus previously to show validation errors */
    @state() private _touchedFields = new Set<string>();

    /** Stores the field, that is currently in focus (to not show validation live) */
    @state() private _focusedField: string | null = null;

    /** State to store the placement of the drawer ('start' for left, 'end' for right) */
    @state() private accessor drawerPlacement: 'start' | 'end' = 'end';

    /** Whether the drawer is shown; set at the start of its show/hide animations so the zoom controls move along with it */
    @state() private accessor _drawerShown: boolean = false;

    /** Property to store the state of the fullscreen mode */
    @property({ type: Boolean }) accessor isFullscreen: boolean = false;

    @query("confirm-dialog") private accessor _confirmDialog!: ConfirmDialog;

    @query("canvas-alert") private accessor _alert!: CanvasAlert;

    @query("#canvas") private accessor _canvas!: SVGSVGElement;

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    /** Panning & Zoom States */
    @state() accessor zoom: number = 1;
    @state() accessor panX: number = 0;
    @state() accessor panY: number = 0;
    private _isPanning: boolean = false;

    /** The fingers currently touching the canvas, by pointer id */
    private _touchPointers = new Map<number, PointerEvent>();

    /** The fingers, zoom and pan at the start of the current pinch; null while not pinching */
    private _pinchStart: { pinch: Pinch, zoom: number, panX: number, panY: number } | null = null;

    /** Store the last position of the pointer */
    private _lastPointerX: number = 0;
    private _lastPointerY: number = 0;

    /** Whether the initial fit to view is still due */
    private _fitPending: boolean = true;

    /** store the height and width of the svg window */
    private _svgWidth: number = 800;
    private _svgHeight: number = 600;

    /** first slot position and slot width */
    private readonly SLOT_SPACING = 250; 
    private readonly START_X = 100;

    /** width of an activation bar and how far each nested bar is shifted to the right */
    private readonly ACTIVATION_WIDTH = 14;
    private readonly ACTIVATION_NESTING_OFFSET = 8;

    /** Fragment Puffer hight for collision with lifeline end */
    private readonly FRAGMENT_MIN_OVERLAP = 30;

    /** variable to block unwanted double clicks */
    private _blockDblClick: boolean = false;

    /** styles are defined in the editor.styles */
    static styles = [styles];

    // --------------------------------------------------------------------------------------------------------
    // Lifecycle and InteractJS
    // --------------------------------------------------------------------------------------------------------

    /** Method to add observer to the start of the Programm */
    protected firstUpdated() {
        // Add observer for the size of window of the editor
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                this._svgWidth = entry.contentRect.width;
                this._svgHeight = entry.contentRect.height;
                this.requestUpdate();
            }
            if (this._fitPending && this._svgWidth && this._svgHeight) {
                this._fitPending = false;
                this.updateComplete.then(() => this._fitToView());
            }
        });
        resizeObserver.observe(this);

        // Pinch to zoom, captured to keep the pinch's fingers from panning and from interact.js
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
            this._canvas.addEventListener(type, (e) => this._handlePinchPointer(e as PointerEvent), true);
        }

        emulateTouchClicks(this._canvas);

        // bound by selector, so once is enough (binding again would replace the listeners mid-drag)
        this._bindActivationDragAndResize();
    }

    /** Method to routine check after each render cycle. In this case to bind interactJs to the elements */
    protected updated(changedProperties: any) {
        super.updated(changedProperties);

        this._bindLifelineDrag();
        this._bindLifelineResize();
        this._bindMessageDrag();
        this._bindFragmentDragAndResize();
        this._updateGridBackground();
    }

    /** Move and scale the dotted background grid with the view, keeping the dots themselves the same size */
    private _updateGridBackground() {
        this.style.setProperty('--grid-size', `${40 * this.zoom}px`);
        this.style.setProperty('--grid-x', `${-this.panX * this.zoom}px`);
        this.style.setProperty('--grid-y', `${-this.panY * this.zoom}px`);
    }

    /**
     * The dragged value (position or size) at the start of the current drag. Drags compute the new value from it and
     * the total pointer movement, so the element follows the pointer again only once the pointer is back in the
     * allowed range, instead of adding up movements onto an already clamped value.
     */
    private _dragStartValue = 0;

    /** The current drag's start value plus the total vertical pointer movement since the drag started */
    private _draggedValueY(event: any): number {
        return this._dragStartValue + (event.clientY - event.clientY0) / this.zoom;
    }

    /** Marks an element as being dragged (only in idle mode, as the drags do nothing in the other modes) */
    private _startDrag(id: string | null, cursor: string) {
        if (this.interactionMode === 'idle') {
            this._activeDrag = { id, cursor };
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // InteractJS Binding Methods (to simplify the updated method
    // --------------------------------------------------------------------------------------------------------

    // All draggables use styleCursor(false): the cursors are defined in the stylesheet, otherwise interact.js
    // sets an inline 'move' cursor on hover that parts without their own cursor (e.g. message lines) inherit.

    /** Iterate over all lifeline elements and bind interactJs to it. The lifelines should be free movable while "in hand" but droped to fixed slots */
    private _bindLifelineDrag() {
        const lifelineElements = Array.from(this.shadowRoot!.querySelectorAll('.lifeline:not([data-bound])')) as SVGGElement[];
        
        lifelineElements.forEach(el => {
            el.setAttribute('data-bound', 'true');
            const id = el.getAttribute('data-id');

            interact(el).styleCursor(false).draggable({
                startAxis: 'x',
                lockAxis: 'x',
                allowFrom: '.lifeline-click-area',
                ignoreFrom: '.lifeline-handle, .selecting *',
                listeners: {
                    start: (event) => {
                        this._startDrag(id, 'grabbing');
                        event.target.setAttribute('data-drag-x', '0');
                        (event.target as HTMLElement).style.opacity = '0.7'; 
                    },
                    move: (event) => {
                        if (!id || this.interactionMode !== 'idle') return;

                        const target = event.target as SVGGElement;
                        let currentDragX = parseFloat(target.getAttribute('data-drag-x') || '0');
                        
                        currentDragX += (event.dx / this.zoom);

                        const currentIndex = this.model.lifelines.findIndex(l => l.id === id);
                        const maxIndex = this.model.lifelines.length - 1;

                        const threshold = this.SLOT_SPACING / 2; 
                        let shift = 0;

                        if (currentDragX > threshold && currentIndex < maxIndex) {
                            shift = 1;  
                            currentDragX -= this.SLOT_SPACING; 
                        } else if (currentDragX < -threshold && currentIndex > 0) {
                            shift = -1; 
                            currentDragX += this.SLOT_SPACING;
                        }

                        target.setAttribute('data-drag-x', currentDragX.toString());
                        target.style.transform = `translateX(${currentDragX}px)`;

                        if (shift !== 0) {
                            this.dispatchEvent(new CustomEvent('reorder-lifeline', {
                                detail: { id: id, shift: shift }
                            }));
                        }
                    },
                    end: (event) => {
                        this._activeDrag = null;
                        const target = event.target as SVGGElement;
                        target.style.transform = '';
                        target.setAttribute('data-drag-x', '0');
                        target.style.opacity = '1';
                    }
                }
            });
        });
    }

    /** Bind InteractJs to the handles at the end of the lifelines to make their length editabele */
    private _bindLifelineResize() {
        const handleElements = Array.from(this.shadowRoot!.querySelectorAll('.lifeline-handle:not([data-bound])')) as SVGElement[];
        
        handleElements.forEach(handle => {
            handle.setAttribute('data-bound', 'true');
            const id = handle.getAttribute('data-id');
            
            interact(handle).styleCursor(false).draggable({
                ignoreFrom: '.selecting *',
                startAxis: 'y',
                lockAxis: 'y',
                listeners: {
                    start: (event) => {
                        event.target.classList.add('dragged');
                        this._startDrag(id, 'ns-resize');
                        this._dragStartValue = this.model.lifelines.find(l => l.id === id)?.length ?? 0;
                    },
                    move: (event) => {
                        if (!id || this.interactionMode !== 'idle') return;
                        const lifeline = this.model.lifelines.find(l => l.id === id);
                        if (lifeline) {
                            let newLength = this._draggedValueY(event);
                            
                            // messages as boundary
                            const connectedMessages = this.model.messages.filter(m => m.sourceId === id || m.targetId === id);
                            let minLengthFromMessages = 0;
                            if (connectedMessages.length > 0) {
                                const maxMessageY = Math.max(...connectedMessages.map(m =>
                                    m.y + (m.type === 'create' ? 40 : m.sourceId === m.targetId ? 30 : 0)));
                                minLengthFromMessages = maxMessageY - lifeline.y + LIFELINE_PADDING;
                            }

                            // activity bar as boundary
                            let minLengthFromActivations = 0;
                            if (lifeline.activations && lifeline.activations.length > 0) {
                                const maxActBottom = Math.max(...lifeline.activations.map(act => act.y + act.length));
                                minLengthFromActivations = maxActBottom - lifeline.y + LIFELINE_PADDING;
                            }

                            // fragment as boundary
                            let minLengthFromFragments = 0;
                            const startedFragments = (this.model.fragments || []).filter(f => f.startLifelineId === id);
                            if (startedFragments.length > 0) {
                                const maxFragStartY = Math.max(...startedFragments.map(f => f.y));
                                minLengthFromFragments = maxFragStartY + this.FRAGMENT_MIN_OVERLAP - lifeline.y + LIFELINE_PADDING;
                            }

                            const finalMinLength = Math.max(
                                MIN_LIFELINE_LENGTH, 
                                minLengthFromMessages, 
                                minLengthFromActivations,
                                minLengthFromFragments
                            );
                            
                            lifeline.length = Math.max(newLength, finalMinLength);
                            this.requestUpdate();
                        }
                    },
                    end: (event) => {
                        event.target.classList.remove('dragged');
                        this._activeDrag = null;
                        if (!id || this.interactionMode !== 'idle') return;
                        const lifeline = this.model.lifelines.find(l => l.id === id);
                        if (lifeline) {
                            this.dispatchEvent(new CustomEvent('update-lifeline', {
                                detail: { id: id, length: lifeline.length }
                            }));
                        }
                    }
                }
            });
        });
    }

    /** Bind InteractJs to the activation bars to move them along the lifelines and resize them at both ends */
    private _bindActivationDragAndResize() {
        // looked up at the start, as the bars are re-rendered while dragging
        let dragged: { lifelineId: string, activation: { id: string, y: number, length: number } } | null = null;
        const findActivation = (target: Element) => {
            const lifelineId = target.getAttribute('data-lifeline-id');
            const id = target.getAttribute('data-id');
            const activation = this.model.lifelines.find(ll => ll.id === lifelineId)?.activations?.find(act => act.id === id);
            return lifelineId && activation ? { lifelineId, activation } : null;
        };

        // movable in y direction
        interact('.draggable-activation').styleCursor(false).draggable({
            ignoreFrom: '.selecting *',
            listeners: {
                start: (event) => {
                    dragged = findActivation(event.target);
                    this._activeDrag = { id: dragged?.activation.id ?? null, cursor: 'grabbing' };
                    this._dragStartValue = dragged?.activation.y ?? 0;
                },
                move: (event) => {
                    if (!dragged || this.interactionMode !== 'idle') return;
                    const { lifelineId, activation } = dragged;
                    const bounds = this._getLifelineVerticalBounds(lifelineId);
                    if (activation.length > bounds.maxY - bounds.minY) return;

                    // stay within the lifeline
                    let newY = Math.max(bounds.minY, this._draggedValueY(event));
                    if (newY + activation.length > bounds.maxY) {
                        newY = bounds.maxY - activation.length;
                    }
                    activation.y = newY;
                    this.requestUpdate();
                },
                end: () => {
                    this._activeDrag = null;
                    if (!dragged) return;
                    const { lifelineId, activation } = dragged;
                    dragged = null;
                    this.dispatchEvent(new CustomEvent('update-activation', {
                        detail: { lifelineId, activationId: activation.id, y: activation.y }
                    }));
                }
            }
        });

        // resizing at the bottom or top edge
        let resizingTop = false;
        let bottomY = 0;
        interact('.activation-resize-handle').styleCursor(false).draggable({
            ignoreFrom: '.selecting *',
            listeners: {
                start: (event) => {
                    dragged = findActivation(event.target);
                    event.target.classList.add('dragged');
                    resizingTop = event.target.getAttribute('data-edge') === 'top';
                    bottomY = dragged ? dragged.activation.y + dragged.activation.length : 0;
                    this._activeDrag = { id: dragged?.activation.id ?? null, cursor: 'ns-resize' };
                    this._dragStartValue = (resizingTop ? dragged?.activation.y : dragged?.activation.length) ?? 0;
                },
                move: (event) => {
                    if (!dragged || this.interactionMode !== 'idle') return;
                    const { lifelineId, activation } = dragged;
                    const bounds = this._getLifelineVerticalBounds(lifelineId);
                    if (resizingTop) {
                        if (bottomY - bounds.minY < 15) return;
                        activation.y = Math.max(bounds.minY, Math.min(this._draggedValueY(event), bottomY - 15));
                        activation.length = bottomY - activation.y;
                    } else {
                        if (bounds.maxY - activation.y < 15) return;
                        activation.length = Math.max(15, Math.min(this._draggedValueY(event), bounds.maxY - activation.y));
                    }
                    this.requestUpdate();
                },
                end: (event) => {
                    event.target.classList.remove('dragged');
                    this._activeDrag = null;
                    if (!dragged) return;
                    const { lifelineId, activation } = dragged;
                    dragged = null;
                    this.dispatchEvent(new CustomEvent('update-activation', {
                        detail: { lifelineId, activationId: activation.id, y: activation.y, length: activation.length }
                    }));
                }
            }
        });
    }

    /** Bind InteractJs to the messages to make them movable in y direction (with constraints) */
    private _bindMessageDrag() {
        const messageElements = Array.from(this.shadowRoot!.querySelectorAll('.message:not([data-bound])')) as SVGElement[];
        
        messageElements.forEach(el => {
            el.setAttribute('data-bound', 'true');
            // read at drag start, as Lit reuses list elements after deletions
            let id: string | null = null;
            
            interact(el).styleCursor(false).draggable({
                ignoreFrom: '.selecting *',
                startAxis: 'y',
                lockAxis: 'y', 
                listeners: {
                    start: () => {
                        id = el.getAttribute('data-id');
                        this._startDrag(id, 'grabbing');
                        this._dragStartValue = this.model.messages.find(m => m.id === id)?.y ?? 0;
                    },
                    move: (event) => {
                        if (!id || this.interactionMode !== 'idle') return;
                        
                        const message = this.model.messages.find(m => m.id === id);
                        if (message) {
                            let proposedY = this._draggedValueY(event); 

                            const bounds = this._getMessageBounds(message.sourceId, message.targetId, message.type, message.id);

                            if (bounds.minY > bounds.maxY) return;
                            proposedY = Math.max(bounds.minY, Math.min(proposedY, bounds.maxY));

                            message.y = proposedY; 

                            if (message.type === 'create') {
                                const targetLL = this.model.lifelines.find(l => l.id === message.targetId);
                                if (targetLL) {
                                    const originalBottom = targetLL.y + targetLL.length;
                                    
                                    const newBoxY = proposedY ;
                                    
                                    targetLL.y = newBoxY;
                                    targetLL.length = Math.max(0, originalBottom - newBoxY); 
                                }
                            }

                            this.requestUpdate();
                        }
                    },
                    end: (event) => {
                        this._activeDrag = null;
                        if (!id || this.interactionMode !== 'idle') return;
                        
                        const message = this.model.messages.find(m => m.id === id);
                        if (message) {
                            this.dispatchEvent(new CustomEvent('update-message', {
                                detail: { id: id, y: message.y }
                            }));

                            if (message.type === 'create') {
                                const targetLL = this.model.lifelines.find(l => l.id === message.targetId);
                                if (targetLL) {
                                    this.dispatchEvent(new CustomEvent('update-lifeline', {
                                        detail: { 
                                            id: targetLL.id, 
                                            y: targetLL.y, 
                                            length: targetLL.length 
                                        }
                                    }));
                                }
                            }
                        }
                    }
                }
            });
        });
    }

    /** Bind InteractJs to the Fragments "Head" to make them movable in y direction and add some kind of handle to make the size (length in y direction) editable */
    private _bindFragmentDragAndResize() {
        // Drag in y direction
        const fragmentHeaders = Array.from(this.shadowRoot!.querySelectorAll('.fragment-header-hitbox:not([data-bound])')) as SVGElement[];
        
        fragmentHeaders.forEach(el => {
            el.setAttribute('data-bound', 'true');
            // read at drag start, as Lit reuses list elements after deletions
            let id: string | null = null;
            
            interact(el).styleCursor(false).draggable({
                ignoreFrom: '.selecting *',
                startAxis: 'y',
                lockAxis: 'y', 
                listeners: {
                    start: () => {
                        id = el.getAttribute('data-id');
                        this._startDrag(id, 'grabbing');
                        this._dragStartValue = this.model.fragments?.find(f => f.id === id)?.y ?? 0;
                    },
                    move: (event) => {
                        if (!id || this.interactionMode !== 'idle') return;
                        
                        const fragment = this.model.fragments?.find(f => f.id === id);
                        if (fragment) {
                            let proposedY = this._draggedValueY(event); 
                            
                            const bounds = this._getLifelineVerticalBounds(fragment.startLifelineId);
                            
                            const safeMinY = bounds.minY;
                            const safeMaxY = bounds.maxY - this.FRAGMENT_MIN_OVERLAP;
                            if (safeMinY > safeMaxY) return;
                            
                            fragment.y = Math.max(safeMinY, Math.min(proposedY, safeMaxY));

                            this.requestUpdate();
                        }
                    },
                    end: (event) => {
                        this._activeDrag = null;
                        if (!id || this.interactionMode !== 'idle') return;
                        
                        const fragment = this.model.fragments?.find(f => f.id === id);
                        if (fragment) {
                            this.dispatchEvent(new CustomEvent('update-fragment', {
                                detail: { id: id, y: fragment.y }
                            }));
                        }
                    }
                }
            });
        });

        // Resize the operands in y direction, the first one also at the top edge
        const fragmentResizeHandles = Array.from(this.shadowRoot!.querySelectorAll('.fragment-operand-resize-handle:not([data-bound])')) as SVGElement[];
        
        fragmentResizeHandles.forEach(handle => {
            handle.setAttribute('data-bound', 'true');
            // read at drag start (see above)
            let fId: string | null = null;
            let oId: string | null = null;
            let resizingTop = false;
            let bottomY = 0;
            
            interact(handle).styleCursor(false).draggable({
                ignoreFrom: '.selecting *',
                startAxis: 'y',
                lockAxis: 'y',
                listeners: {
                    start: () => {
                        handle.classList.add('dragged');
                        fId = handle.getAttribute('data-fragment-id');
                        oId = handle.getAttribute('data-operand-id');
                        resizingTop = handle.getAttribute('data-edge') === 'top';
                        this._startDrag(fId, 'ns-resize');
                        const fragment = this.model.fragments?.find(f => f.id === fId);
                        const height = fragment?.operands.find(o => o.id === oId)?.height ?? 0;
                        bottomY = (fragment?.y ?? 0) + height;
                        this._dragStartValue = resizingTop ? fragment?.y ?? 0 : height;
                    },
                    move: (event) => {
                        if (!fId || !oId || this.interactionMode !== 'idle') return;
                        
                        const fragment = this.model.fragments?.find(f => f.id === fId);
                        const operand = fragment?.operands.find(o => o.id === oId);
                        
                        if (fragment && operand) {
                            if (resizingTop) {
                                const minY = this._getLifelineVerticalBounds(fragment.startLifelineId).minY;
                                if (bottomY - minY < 30) return;
                                fragment.y = Math.max(minY, Math.min(this._draggedValueY(event), bottomY - 30));
                                operand.height = bottomY - fragment.y;
                            } else {
                                operand.height = Math.max(30, this._draggedValueY(event));
                            }
                            this.requestUpdate();
                        }
                    },
                    end: (event) => {
                        handle.classList.remove('dragged');
                        this._activeDrag = null;
                        if (!fId || this.interactionMode !== 'idle') return;
                        
                        const fragment = this.model.fragments?.find(f => f.id === fId);
                        if (fragment) {
                            const updatedOperands = fragment.operands.map(o => ({ ...o }));
                            
                            this.dispatchEvent(new CustomEvent('update-fragment', {
                                detail: { 
                                    id: fId, 
                                    y: fragment.y,
                                    operands: updatedOperands 
                                }
                            }));
                        }
                    }
                }
            });
        });
    }

    // --------------------------------------------------------------------------------------------------------
    // Viewpoint and Canvas Controles
    // --------------------------------------------------------------------------------------------------------

    /** Without any lifelines there is no reference point, so the canvas cannot be panned or zoomed */
    private get _isEmpty(): boolean {
        return !this.model?.lifelines?.length;
    }

    public async showNotice(message: string) {
        await this._alert.show(message);
    }

    public confirm(options: ConfirmOptions): Promise<boolean> {
        return this._confirmDialog.confirm(options);
    }

    /** Close the drawer if its element was removed (e.g. by undo) and reset an empty canvas to its initial view */
    protected willUpdate(changedProperties: any) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('model')) {
            const { lifelines, messages, fragments = [] } = this.model;
            if (this.editingLifelineId && !lifelines.some(ll => ll.id === this.editingLifelineId)) this.editingLifelineId = null;
            if (this.editingMessageId && !messages.some(m => m.id === this.editingMessageId)) this.editingMessageId = null;
            if (this.editingFragmentId && !fragments.some(f => f.id === this.editingFragmentId)) this.editingFragmentId = null;
            const activation = this.editingActivation;
            if (activation && !lifelines.find(ll => ll.id === activation.lifelineId)?.activations?.some(a => a.id === activation.id)) {
                this.editingActivation = null;
            }
        }
        if (this._isEmpty) {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
        }
    }

    /** Handle the zooming with the mouseweel taking the mouse position into account */
    private _handleWheel(e: WheelEvent) {
        if (this._isEmpty) return;
        e.preventDefault(); 
        
        const zoomSensitivity = 0.0015;
        const delta = -e.deltaY * zoomSensitivity;
        // Zoom Limit: 30% - 300%
        const newZoom = Math.min(Math.max(0.3, this.zoom + delta), 3);

        // calculate mouse position relative to the svg-container
        const rect = this.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const rx = mouseX / this._svgWidth;
        const ry = mouseY / this._svgHeight;

        // calculate dimensions of the current and new view
        const newViewWidth = this._svgWidth / newZoom;
        const newViewHeight = this._svgHeight / newZoom;
        const oldViewWidth = this._svgWidth / this.zoom;
        const oldViewHeight = this._svgHeight / this.zoom;

        // move view based on the relative mouse posiion and apply the new zoom
        this.panX += (oldViewWidth - newViewWidth) * rx;
        this.panY += (oldViewHeight - newViewHeight) * ry;
        this.zoom = newZoom;
    }

    /** if mousclick down on the background activate panning */
    private _handlePointerDown(e: PointerEvent) {
        if (this._isEmpty || this._pinchStart) return;
        const target = e.target as SVGElement;
        if (target.tagName.toLowerCase() === 'svg') {
            this._isPanning = true;
            this._activeDrag = { id: null, cursor: 'move' };
            this._lastPointerX = e.clientX;
            this._lastPointerY = e.clientY;
            target.setPointerCapture(e.pointerId);
        }
    }

    /** when panning is active watch for mouse movement to move the "background" of the diagram */
    private _handlePointerMove(e: PointerEvent) {
        if (!this._isPanning) return;
        
        // calculate how far to move
        const dx = (e.clientX - this._lastPointerX) / this.zoom;
        const dy = (e.clientY - this._lastPointerY) / this.zoom;
        
        // move in the different direction then the movement took place
        this.panX -= dx;
        this.panY -= dy;
        
        this._lastPointerX = e.clientX;
        this._lastPointerY = e.clientY;
    }

    /** when the movedown is released stop the panning */
    private _handlePointerUp(e: PointerEvent) {
        if (this._isPanning) {
            this._isPanning = false;
            this._activeDrag = null;
            const target = e.target as SVGElement;
            target.releasePointerCapture(e.pointerId);
        }
    }

    /**
     * Zoom and pan with two fingers. Once a second finger touches the canvas, their movements no longer pan the view
     * or reach interact.js until all fingers are lifted, so no element is dragged at the same time.
     */
    private _handlePinchPointer(e: PointerEvent) {
        if (e.pointerType !== 'touch') return;
        const pointers = this._touchPointers;

        if (e.type === 'pointerdown') {
            // Each touch gesture starts with the primary pointer, which drops fingers whose release was missed
            if (e.isPrimary) pointers.clear();
            pointers.set(e.pointerId, e);
        } else if (e.type === 'pointermove') {
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, e);
        } else {
            // Releases still reach interact.js, so it ends the pointers it saw go down
            pointers.delete(e.pointerId);
        }
        const [a, b] = pointers.values();

        if (!this._pinchStart) {
            if (e.type !== 'pointerdown' || pointers.size < 2 || this._isEmpty) return;
            e.stopPropagation();
            // An element already being dragged keeps being dragged, ignoring the second finger
            if (this._activeDrag && !this._isPanning) return;
            this._isPanning = false;
            this._activeDrag = null;
        } else if (e.type === 'pointerdown' || e.type === 'pointermove') {
            e.stopPropagation();
        }
        // A single finger is ignored until lifted
        if (!b) {
            if (!a) this._pinchStart = null;
            return;
        }
        if (e.type === 'pointermove') return this._applyPinch(measurePinch(a, b));

        // The pinch starts, or fingers were added or lifted: continue from their current position
        this._pinchStart = { pinch: measurePinch(a, b), zoom: this.zoom, panX: this.panX, panY: this.panY };
    }

    /** Zoom by the change of the finger distance, keeping the diagram point under the fingers' midpoint under them */
    private _applyPinch(pinch: Pinch) {
        const start = this._pinchStart!;
        // Zoom Limit: 30% - 300%
        const zoom = Math.min(Math.max(0.3, start.zoom * pinch.distance / start.pinch.distance), 3);

        const rect = this._canvas.getBoundingClientRect();
        this.panX = start.panX + (start.pinch.x - rect.left) / start.zoom - (pinch.x - rect.left) / zoom;
        this.panY = start.panY + (start.pinch.y - rect.top) / start.zoom - (pinch.y - rect.top) / zoom;
        this.zoom = zoom;
    }

    /** Zoom in or out by a given factor (to or from the middle of the current view (instead of mouse position as in zooming with the weel))*/
    private _zoomByFactor(zoomDelta: number) {
        // Zoom-Limit: 30% - 300%
        const newZoom = Math.min(Math.max(0.3, this.zoom + zoomDelta), 3); 
        
        const rx = 0.5;
        const ry = 0.5;

        const newViewWidth = this._svgWidth / newZoom;
        const newViewHeight = this._svgHeight / newZoom;
        const oldViewWidth = this._svgWidth / this.zoom;
        const oldViewHeight = this._svgHeight / this.zoom;

        this.panX += (oldViewWidth - newViewWidth) * rx;
        this.panY += (oldViewHeight - newViewHeight) * ry;
        this.zoom = newZoom;
    }

    /** Zoom in to the center by factor 20% */
    private _zoomIn() {
        this._zoomByFactor(0.2); 
    }

    /** Zoom out from the center by factor 20% */
    private _zoomOut() {
        this._zoomByFactor(-0.2);
    }

    /** Zoom and pan so that the whole diagram fits into the view, aligned to its top-left corner with some padding */
    private _fitToView() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this._canvas.querySelectorAll<SVGGElement>(':scope > g').forEach(g => {
            const box = g.getBBox();
            if (box.width === 0 && box.height === 0) return;
            minX = Math.min(minX, box.x);
            minY = Math.min(minY, box.y);
            maxX = Math.max(maxX, box.x + box.width);
            maxY = Math.max(maxY, box.y + box.height);
        });
        if (minX === Infinity || this._svgWidth === 0 || this._svgHeight === 0) return;

        // Zoom-Limit: 30%, and never enlarge beyond 100%
        const padding = 32;
        const zoom = Math.max(0.3, Math.min(
            (this._svgWidth - 2 * padding) / (maxX - minX),
            (this._svgHeight - 2 * padding) / (maxY - minY),
            1
        ));

        this.panX = minX - padding / zoom;
        this.panY = minY - padding / zoom;
        this.zoom = zoom;
    }

    // --------------------------------------------------------------------------------------------------------
    // Core Helpers and Global Interaction
    // --------------------------------------------------------------------------------------------------------

    /** Get the x coordinate of a lifeline with a given id */
    private _getLifelineX(id: string): number {
        const index = this.model.lifelines.findIndex(ll => ll.id === id);
        if (index === -1) return 0;
        return this.START_X + (index * this.SLOT_SPACING);
    }

    /** The grip of a resize handle, shown on hover */
    private _renderResizeGrip(x: number, y: number) {
        return svg`<circle class="resize-grip" cx="${x}" cy="${y}" r="4" />`;
    }

    /** Determines if the drawer should open on the left or right based on click position */
    private _setDrawerPlacement(e: MouseEvent) {
        const rect = this.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            this.drawerPlacement = 'end';
        } else {
            this.drawerPlacement = 'start';
        }
    }

    /** 
     * Handles what happens by a click on a lifeline depending on the interaction mode:
     * where to add an activity bar (id of liveline and y coordinate)
     * where to start a fragment (livelineId and y coordingate)
     * where to end a fragment (livelineId and y coordinate)
     * where to start and end a message (liveline id and y coordinate)
     * for each the end y coordinate is relevant in the end
     */
    private _handleLifelineClick(e: MouseEvent, id: string) {
        if (this.interactionMode === 'idle') return;

        // calculate the coordinate of the click
        const svg = this.shadowRoot!.querySelector('svg') as SVGSVGElement;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());

        // activities 
        if (this.interactionMode === 'add-activation') {
            const { minY, maxY } = this._getLifelineVerticalBounds(id);
            const DEFAULT_LENGTH = 60;
            const MIN_LENGTH = 15; 

            if (svgP.y < minY || svgP.y >= maxY) {
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            const availableSpace = maxY - svgP.y;

            let safeLength = Math.min(DEFAULT_LENGTH, availableSpace);

            if (safeLength < MIN_LENGTH) {
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            setTimeout(() => { this._blockDblClick = false; }, 300);
            
            this.dispatchEvent(new CustomEvent('add-activation-at', {
                detail: { id: id, y: svgP.y, length: safeLength } 
            }));
            return; 
        }

        // fragment (start) 
        if (this.interactionMode === 'creating-fragment-start') {
            const { minY, maxY } = this._getLifelineVerticalBounds(id);
            
            const safeMaxY = maxY - this.FRAGMENT_MIN_OVERLAP;
            if (minY > safeMaxY) {
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }
            
            const clampedY = Math.max(minY, Math.min(svgP.y, safeMaxY));

            this.dispatchEvent(new CustomEvent('select-fragment-source', { 
                detail: { id, y: clampedY } 
            }));
            return; 
        }

        // fragment (end)
        if (this.interactionMode === 'creating-fragment-end') {
            this._blockDblClick = true;
            setTimeout(() => { this._blockDblClick = false; }, 300);

            this.dispatchEvent(new CustomEvent('select-fragment-target', { 
                detail: { id, y: svgP.y } 
            }));
            return;
        }

        // message
        if (this.interactionMode === 'add-message-source') {
            
            // for "lost" and "create-new" the first click is already the final click
            if (this.pendingMessageType === 'lost' || this.pendingMessageType === 'create-new') {
                const mappedType = this.pendingMessageType === 'create-new' ? 'create' : 'lost';
                const bounds = this._getMessageBounds(id, 'external', mappedType);
                
                if (svgP.y < bounds.minY || svgP.y > bounds.maxY) {
                    this.showNotice(msg("Message cannot be placed here (outside of logical boundaries)."));
                    this.dispatchEvent(new CustomEvent('cancel-interaction'));
                    return;
                }
            }
            
            this.dispatchEvent(new CustomEvent('select-source', { detail: { id, y: svgP.y } }));

        } else if (this.interactionMode === 'add-message-target') {
            this._blockDblClick = true;
            setTimeout(() => { this._blockDblClick = false; }, 300);

            const mappedType = this.pendingMessageType === 'create-existing' ? 'create' : this.pendingMessageType;
            const source = this.messageSourceId === 'external' ? 'external' : this.messageSourceId!;
            
            if (mappedType === 'create' && source === id) {
                this.showNotice(msg("An object cannot create itself (self-create is not allowed)."));
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            const bounds = this._getMessageBounds(source, id, mappedType);
            
            if (svgP.y < bounds.minY || svgP.y > bounds.maxY) {
                this.showNotice(msg("Message cannot be placed here (outside of logical boundaries or inside the name box)."));
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            this.dispatchEvent(new CustomEvent('select-target', { detail: { id, y: svgP.y } }));
        }
    }

    /** Calculate the y-borders to decide where messages are allowed to be moved/initially placed */
    private _getMessageBounds(sourceId: string, targetId: string, type: string, ignoreMsgId: string | null = null): { minY: number, maxY: number } {
        const sourceLL = this.model.lifelines.find(l => l.id === sourceId);
        const targetLL = this.model.lifelines.find(l => l.id === targetId);

        let minSourceY = 0;
        let maxSourceY = Infinity;
        let minTargetY = 0;
        let maxTargetY = Infinity;

        if (sourceLL) {
            minSourceY = sourceLL.y + 80 + LIFELINE_PADDING;
            
            const sourceDestroy = this.model.messages.find(m => m.type === 'destroy' && m.targetId === sourceLL.id && m.id !== ignoreMsgId);
            maxSourceY = (sourceDestroy?.y ?? sourceLL.y + sourceLL.length) - LIFELINE_PADDING;
        }

        if (targetLL) {
            minTargetY = targetLL.y + 80 + LIFELINE_PADDING;
            
            const targetDestroy = this.model.messages.find(m => m.type === 'destroy' && m.targetId === targetLL.id && m.id !== ignoreMsgId);
            maxTargetY = (targetDestroy?.y ?? targetLL.y + targetLL.length) - LIFELINE_PADDING;
        }

        let minY = 0;
        let maxY = Infinity;

        if (type === 'create') {
            // upper bound: only in source
            // lower bound: first message in target
            minY = minSourceY - 40; 

            let firstTargetMsgY = Infinity;
            if (targetLL) {
                const targetMsgs = this.model.messages.filter(m => (m.sourceId === targetId || m.targetId === targetId) && m.id !== ignoreMsgId && m.type !== 'create');
                if (targetMsgs.length > 0) {
                    firstTargetMsgY = Math.min(...targetMsgs.map(m => m.y)) - 80 - LIFELINE_PADDING;
                }
            }
            // Create messages store the target box's top; the arrow is 40px below it.
            const targetBoxMaxY = targetLL ? targetLL.y + targetLL.length - MIN_LIFELINE_LENGTH : Infinity;
            maxY = Math.min(maxSourceY - 40, firstTargetMsgY, targetBoxMaxY);

        } else if (type === 'destroy') {
            // upper bound: last message in target
            // lower bound: only in source
            maxY = maxSourceY;

            let lastTargetMsgY = 0;
            if (targetLL) {
                const targetMsgs = this.model.messages.filter(m => (m.sourceId === targetId || m.targetId === targetId) && m.id !== ignoreMsgId && m.type !== 'destroy');
                if (targetMsgs.length > 0) {
                    lastTargetMsgY = Math.max(...targetMsgs.map(m => m.y)) + LIFELINE_PADDING;
                } else {
                    lastTargetMsgY = minTargetY;
                }
            }
            minY = Math.max(minSourceY, lastTargetMsgY);

        } else if (type === 'found') {
            // found has no source
            minY = minTargetY;
            maxY = maxTargetY;
        } else if (type === 'lost') {
            // lost has no target
            minY = minSourceY;
            maxY = maxSourceY;
        } else {
            // normal messages
            minY = Math.max(sourceLL ? minSourceY : 0, targetLL ? minTargetY : 0);
            maxY = Math.min(maxSourceY, maxTargetY);
        }

        // Self messages return 30px below their starting point.
        if (sourceId === targetId && type !== 'create') maxY -= 30;

        return { minY, maxY };
    }

    /** Padded bounds for activations and fragments. */
    private _getLifelineVerticalBounds(llId: string): { minY: number, maxY: number } {
        const ll = this.model.lifelines.find(l => l.id === llId);
        if (!ll) return { minY: 0, maxY: Infinity };

        const minY = ll.y + 80 + LIFELINE_PADDING;
        const destroyMsg = this.model.messages.find(m => m.type === 'destroy' && m.targetId === llId);
        const maxY = destroyMsg
            ? destroyMsg.y + (destroyMsg.sourceId === destroyMsg.targetId ? 30 : 0)
            : ll.y + ll.length;

        return { minY, maxY: maxY - LIFELINE_PADDING };
    }

    // --------------------------------------------------------------------------------------------------------
    // Lifelines/Objects (Drawer)
    // --------------------------------------------------------------------------------------------------------

    /** Close other drawer menus and open the lifeline drawer menu for the dblclicked one */
    private _handleLifelineDblClick(e: MouseEvent, id: string) {
        if (this._blockDblClick) return;

        if (this.interactionMode === 'idle') {
            this._setDrawerPlacement(e);
            this.editingMessageId = null; 
            this.editingActivation = null; 
            this.editingFragmentId = null;
            this.editingLifelineId = id;
        }
    }

    /** Handle updates for the lifeline data from within the drawer and despatch an event to inform the controller about it */
    private _handleLifelineUpdate(field: string, value: string) {
        if (!this.editingLifelineId) return;
        
        this.dispatchEvent(new CustomEvent('update-lifeline', {
            detail: {
                id: this.editingLifelineId,
                [field]: value
            }
        }));
    }

    /** built per call so the labels follow the current locale */
    private _lifelineIconOptions() {
        return [
            { value: 'none', label: msg("No icon"), src: noIcon },
            { value: 'user', label: msg("User"), src: iconMap['user'] },
            { value: 'users', label: msg("Users"), src: iconMap['users'] },
            { value: 'device-desktop', label: msg("Desktop"), src: iconMap['device-desktop'] },
            { value: 'device-mobile', label: msg("Mobile"), src: iconMap['device-mobile'] },
            { value: 'world', label: msg("Globe"), src: iconMap['world'] },
            { value: 'server', label: msg("Server"), src: iconMap['server'] },
            { value: 'cloud', label: msg("Cloud"), src: iconMap['cloud'] },
            { value: 'database', label: msg("Database"), src: iconMap['database'] },
            { value: 'api', label: msg("API"), src: iconMap['api'] },
            { value: 'settings', label: msg("Gear"), src: iconMap['settings'] },
            { value: 'lock', label: msg("Lock"), src: iconMap['lock'] },
            { value: 'mail', label: msg("Mail"), src: iconMap['mail'] },
            { value: 'file', label: msg("File"), src: iconMap['file'] },
            { value: 'clock', label: msg("Clock"), src: iconMap['clock'] },
            { value: 'credit-card', label: msg("Credit Card"), src: iconMap['credit-card'] },
        ];
    }

    /** Handles the click on the delete button in the liveline drawer menu and inform the controller */
    private _handleDeleteLifelineClick() {
        if (this.editingLifelineId) {
            this.dispatchEvent(new CustomEvent('delete-lifeline', {
                detail: { id: this.editingLifelineId },
                bubbles: true,
                composed: true
            }));
            this.editingLifelineId = null;
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // Messages (Drawer)
    // --------------------------------------------------------------------------------------------------------

    /** If in idle mode, close other drawer menus and open the message drawer menu for the dblclicked message */
    private _handleMessageDblClick(e: MouseEvent, id: string) {
        if (this._blockDblClick) return;

        if (this.interactionMode === 'idle') {
            this._setDrawerPlacement(e);
            this.editingLifelineId = null; 
            this.editingActivation = null; 
            this.editingFragmentId = null;
            this.editingMessageId = id; 
        }
    }

    /** Inform the controller about changes on the message data from changes within the message drawer menu */
    private _handleMessageUpdate(field: string, value: string) {
        if (!this.editingMessageId) return;
        
        this.dispatchEvent(new CustomEvent('update-message', {
            detail: {
                id: this.editingMessageId,
                [field]: value
            }
        }));
    }

    /** Inform the controller about the click on the delete button inside the message drawer menu and close the drawer*/
    private _handleDeleteMessageClick() {
        if (this.editingMessageId) {
            this.dispatchEvent(new CustomEvent('delete-message', {
                detail: { id: this.editingMessageId },
                bubbles: true,
                composed: true
            }));
            this.editingMessageId = null;
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // Activations (Drawer)
    // --------------------------------------------------------------------------------------------------------

    /** If in idle mode, close other drawer menus and open the activation drawer menu for the dblclicked message */
    private _handleActivationDblClick(e: MouseEvent, lifelineId: string, activationId: string) {
        // don't also use the dblclick for the lifeline
        e.stopPropagation();
        
        if (this._blockDblClick) return;

        if (this.interactionMode === 'idle') {
            this._setDrawerPlacement(e);
            this.editingLifelineId = null;
            this.editingMessageId = null;
            this.editingFragmentId = null;
            this.editingActivation = { lifelineId, id: activationId };
        }
    }

    /** Inform the controller about the click on the delete button inside the activation drawer menu and close the drawer */
    private _handleDeleteActivationClick() {
        if (this.editingActivation) {
            this.dispatchEvent(new CustomEvent('delete-activation', {
                detail: { 
                    lifelineId: this.editingActivation.lifelineId, 
                    activationId: this.editingActivation.id 
                }
            }));
            this.editingActivation = null; 
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // Fragments (Drawer)
    // --------------------------------------------------------------------------------------------------------

    /** If in idle mode, close other drawer menus and open the fragment drawer menu for the dblclicked message */
    private _editFragment(e: MouseEvent, id: string) {
        this._setDrawerPlacement(e);
        this.editingLifelineId = null;
        this.editingMessageId = null;
        this.editingActivation = null;
        this.editingFragmentId = id;
    }

    /** Updates a top-level property (e.g., type) of the currently edited fragment */
    private _handleFragmentUpdate(field: string, value: string) {
        if (!this.editingFragmentId) return;
        
        this.dispatchEvent(new CustomEvent('update-fragment', {
            detail: {
                id: this.editingFragmentId,
                [field]: value
            }
        }));
    }

    /** Updates the guard condition of a specific region (operand) within the currently edited fragment */
    private _handleFragmentOperandUpdate(operandId: string, newGuard: string) {
        if (!this.editingFragmentId) return;
        
        const frag = this.model.fragments?.find(f => f.id === this.editingFragmentId);
        if (!frag) return;

        const updatedOperands = frag.operands.map(o => 
            o.id === operandId ? { ...o, guard: newGuard } : { ...o }
        );

        this.dispatchEvent(new CustomEvent('update-fragment', {
            detail: { id: frag.id, operands: updatedOperands }
        }));
    }

    /** Handler to add a new region to an alternative fragment */
    private _handleAddFragmentRegion() {
        if (!this.editingFragmentId) return;
        
        const frag = this.model.fragments?.find(f => f.id === this.editingFragmentId);
        if (!frag) return;

        const newOperand = { id: 'op-' + Date.now(), guard: "[else]", height: 60 };
        this.dispatchEvent(new CustomEvent('update-fragment', {
            detail: { id: frag.id, operands: [...frag.operands, newOperand] }
        }));
    }

    /** Handler to remove a region from an alternative fragment */
    private _handleRemoveFragmentRegion() {
        if (!this.editingFragmentId) return;
        
        const frag = this.model.fragments?.find(f => f.id === this.editingFragmentId);
        if (!frag || frag.operands.length <= 1) return;

        const updatedOperands = frag.operands.slice(0, -1);
        this.dispatchEvent(new CustomEvent('update-fragment', {
            detail: { id: frag.id, operands: updatedOperands }
        }));
    }

    /** Hander to remove a region in an alt fragment */
    private _handleRemoveFragmentOperand(operandId: string) {
        const frag = this.model.fragments?.find(f => f.id === this.editingFragmentId);
        if (!frag || frag.operands.length <= 1) return;
        frag.operands = frag.operands.filter(op => op.id !== operandId);
        this.requestUpdate();
        this.dispatchEvent(new CustomEvent('model-changed', { bubbles: true, composed: true }));
    }

    /** Handler to delete a fragment from within the drawer menu */
    private _handleDeleteFragmentClick() {
        if (!this.editingFragmentId) return;
        
        this.dispatchEvent(new CustomEvent('delete-fragment', { 
            detail: { id: this.editingFragmentId } 
        }));
        this.editingFragmentId = null;
    }

    // =========================================================================================
    // Validation Engine
    // =========================================================================================

    /** searches the diagram and collects all validation rule breaks */
    private _getAllValidationIssues(): ValidationIssue<SequenceSettings>[] {
        if (!this.model) return [];
        const issues: ValidationIssue<SequenceSettings>[] = [];

        // check objects/lifelines
        this.model.lifelines.forEach(ll => {
            // object or class name required
            if (!ll.name || ll.name.trim() === '') {
                issues.push({
                    target: `ll-${ll.id}-name`,
                    message: msg("Object name is required."),
                    settingKey: 'checkForEmptyObjectNames'
                });
            }
            if (!ll.className || ll.className.trim() === '') {
                issues.push({
                    target: `ll-${ll.id}-classname`,
                    message: msg("Class name is required."),
                    settingKey: 'checkForEmptyClassNames'
                });
            }

            // object name should start with lower case letter
            if (ll.name && /^[A-ZÄÖÜ]/.test(ll.name.trim())) {
                issues.push({
                    target: `ll-${ll.id}-name`,
                    message: msg("Object names should start with a lowercase letter (e.g. myObject)."),
                    settingKey: 'checkForFirstLetterOfObject'
                });
            }

            // object name shouldn't contain space
            if (ll.name && /\s/.test(ll.name.trim())) {
                issues.push({
                    target: `ll-${ll.id}-name`,
                    message: msg('Object names must not contain spaces.'),
                    settingKey: 'checkForFirstLetterOfObject'
                });
            }

            // class name should start with upper case letter
            if (ll.className && /^[a-zäöü]/.test(ll.className.trim())) {
                issues.push({
                    target: `ll-${ll.id}-classname`,
                    message: msg("Class names should start with an uppercase letter (e.g. Customer)."),
                    settingKey: 'checkForFirstLetterOfClass'
                });
            }

            // class name shouldn't contain space
            if (ll.className && /\s/.test(ll.className.trim())) {
                issues.push({
                    target: `ll-${ll.id}-classname`,
                    message: msg('Class names must not contain spaces.'),
                    settingKey: 'checkForFirstLetterOfClass'
                });
            }
        });

        // check messages
        this.model.messages.forEach(m => {
            // messages are normaly methods and should start with a lower case letter (except replys)
            if (m.name && m.type !== 'reply' && !m.name.trim().startsWith('<') && /^[A-ZÄÖÜ]/.test(m.name.trim())) {
                issues.push({
                    target: `msg-${m.id}-name`,
                    message: msg("Message names, except replies, should start with a lowercase letter."),
                    settingKey: 'checkForFirstLetterOfMessages'
                });
            }

            // assignment should not contain spaces
            if (m.assignment && /\s/.test(m.assignment.trim())) {
                issues.push({
                    target: `msg-${m.id}-assignment`,
                    message: msg('Assignment must not contain spaces.'),
                    settingKey: 'checkForFirstLetterOfMessages'
                });
            }
        });

        

        // check fragments
        (this.model.fragments || []).forEach(frag => {
            frag.operands.forEach(op => {
                // condition should not be empty or contain only our placeholder
                const guardText = op.guard ? op.guard.trim() : '';
                if (guardText === '' || guardText === '[condition]' || guardText === '[]') {
                    issues.push({
                        target: `frag-${frag.id}-op-${op.id}-guard`,
                        message: msg("Guard condition must not be empty."),
                        settingKey: 'checkForEmptyGuards'
                    });
                }
            });
        });

        return issues;
    }

    /** Filters the syntax errors made by our active validation rules */
    private get _activeIssues(): ValidationIssue<SequenceSettings>[] {
        return this.globalSettings.activeIssues(this._getAllValidationIssues(), this.settings);
    }

    /** Returns a set of fragment IDs that overlap with other fragments (nesting is allowed) */
    private _getOverlappingFragmentIds(): Set<string> {
        const overlapping = new Set<string>();
        const fragments = this.model.fragments || [];

        // helper to calculate the y-range of the operands of a fragment
        const getOperandRanges = (frag: any): { top: number, bottom: number }[] => {
            let currentY = frag.y;
            return frag.operands.map((op: any) => {
                const range = { top: currentY, bottom: currentY + op.height };
                currentY += op.height;
                return range;
            });
        };

        // helper to check if one fragment is fully inside of another fragments operand
        const fitsInOneOperand = (fragB: any, fragA: any): boolean => {
            const bTop = fragB.y;
            const bBottom = fragB.y + fragB.operands.reduce((sum: number, op: any) => sum + op.height, 0);
            const ranges = getOperandRanges(fragA);
            return ranges.some(r => bTop >= r.top && bBottom <= r.bottom);
        };

        fragments.forEach((fragA, i) => {
            const aHeight = fragA.operands.reduce((sum: number, op: any) => sum + op.height, 0);
            const aTop = fragA.y;
            const aBottom = fragA.y + aHeight;

            const aStartIdx = this.model.lifelines.findIndex(ll => ll.id === fragA.startLifelineId);
            const aEndIdx = this.model.lifelines.findIndex(ll => ll.id === fragA.endLifelineId);
            const aMinIdx = Math.min(aStartIdx, aEndIdx);
            const aMaxIdx = Math.max(aStartIdx, aEndIdx);

            fragments.forEach((fragB, j) => {
                if (i >= j) return;

                const bHeight = fragB.operands.reduce((sum: number, op: any) => sum + op.height, 0);
                const bTop = fragB.y;
                const bBottom = fragB.y + bHeight;

                const bStartIdx = this.model.lifelines.findIndex(ll => ll.id === fragB.startLifelineId);
                const bEndIdx = this.model.lifelines.findIndex(ll => ll.id === fragB.endLifelineId);
                const bMinIdx = Math.min(bStartIdx, bEndIdx);
                const bMaxIdx = Math.max(bStartIdx, bEndIdx);

                // return if no horizontal overlap
                const horizontalOverlap = aMinIdx <= bMaxIdx && bMinIdx <= aMaxIdx;
                if (!horizontalOverlap) return;

                const aContainsB = aTop <= bTop && aBottom >= bBottom;
                const bContainsA = bTop <= aTop && bBottom >= aBottom;

                if (aContainsB) {
                    // nesting is only valid if the fragment is horizontal and vertically fully inside an operand of the other fragment
                    const horizontallyContained = bMinIdx >= aMinIdx && bMaxIdx <= aMaxIdx;
                    const inOneOperand = fitsInOneOperand(fragB, fragA);
                    if (!horizontallyContained || !inOneOperand) {
                        overlapping.add(fragA.id);
                        overlapping.add(fragB.id);
                    }
                    return;
                }

                if (bContainsA) {
                    const horizontallyContained = aMinIdx >= bMinIdx && aMaxIdx <= bMaxIdx;
                    const inOneOperand = fitsInOneOperand(fragA, fragB);
                    if (!horizontallyContained || !inOneOperand) {
                        overlapping.add(fragA.id);
                        overlapping.add(fragB.id);
                    }
                    return;
                }

                const partialOverlap = aTop < bBottom && bTop < aBottom;
                if (partialOverlap) {
                    overlapping.add(fragA.id);
                    overlapping.add(fragB.id);
                }
            });
        });

        return overlapping;
    }

    /** Adds a field to the list of already touched fields to show validation errors */
    private _handleBlur(targetId: string) {
        this._focusedField = null;
        
        const newSet = new Set(this._touchedFields);
        newSet.add(targetId);
        this._touchedFields = newSet;
        
        this.requestUpdate();
    }

    /** Delets the field of the list of already touched fields when it returns to focus */
    private _handleFocus(targetId: string) {
        this._focusedField = targetId;
        this.requestUpdate();
    }

    // --------------------------------------------------------------------------------------------------------
    // Rendering
    // --------------------------------------------------------------------------------------------------------

    render() {

        // logic for the validation
        const issues = this._activeIssues;
        const shouldShowError = (targetId: string) => {
            if (this._focusedField === targetId) return null;

            const hasIssue = issues.find(i => i.target === targetId);
            if (!hasIssue) return null;

            if (this._touchedFields.has(targetId)) {
                return hasIssue;
            }
            
            return null;
        };

        if (!this.model) return html``;

        // the activation bars of every lifeline from top to bottom with their x position, shifted right for each bar they start inside of
        const activationBars = new Map(this.model.lifelines.map(ll => {
            const activations = [...(ll.activations || [])].sort((a, b) => a.y - b.y);
            const lifelineX = this._getLifelineX(ll.id);
            return [ll.id, activations.map((activation, index) => {
                const nestingLevel = activations.slice(0, index)
                    .filter(outer => activation.y >= outer.y && activation.y < outer.y + outer.length).length;
                return { activation, nested: nestingLevel > 0, x: lifelineX - this.ACTIVATION_WIDTH / 2 + nestingLevel * this.ACTIVATION_NESTING_OFFSET };
            })];
        }));

        // messages start and end at the edges of the activation bars active at their height (the right edge if
        // they continue to the right) instead of running underneath them, or at the lifeline if there are none
        const messageEndX = (lifelineId: string, y: number, rightEdge: boolean) => {
            const bars = (activationBars.get(lifelineId) || [])
                .filter(({ activation }) => y >= activation.y && y <= activation.y + activation.length);
            if (bars.length === 0) return this._getLifelineX(lifelineId);
            return rightEdge
                ? Math.max(...bars.map(bar => bar.x + this.ACTIVATION_WIDTH))
                : Math.min(...bars.map(bar => bar.x));
        };

        // get the current edited lifeline for the drawer
        const editingLifeline = this.editingLifelineId 
            ? this.model.lifelines.find(l => l.id === this.editingLifelineId) 
            : null;

        // get the current edited message for the drawer
        const editingMessage = this.editingMessageId
            ? this.model.messages.find(m => m.id === this.editingMessageId)
            : null;

        // check if it is allowed to change the type to the following
        const isStructuralMessage = editingMessage 
            ? ['create', 'destroy', 'found', 'lost'].includes(editingMessage.type)
            : false;

        return html`
            <canvas-alert
                .hint=${this.interactionMode === 'idle' ? null
                    : this.interactionMode === 'add-message-source' ? msg("Select sending lifeline")
                    : this.interactionMode === 'add-activation' ? msg("Select a lifeline")
                    : this.interactionMode === 'creating-fragment-start' ? msg("Select start lifeline")
                    : this.interactionMode === 'creating-fragment-end' ? msg("Select end lifeline")
                    : msg("Select receiving lifeline")}
                @hint-closed=${() => this.dispatchEvent(new CustomEvent('cancel-interaction'))}
            ></canvas-alert>

            <svg 
                id="canvas"
                class="${this._isEmpty ? 'empty' : ''} ${this._activeDrag ? 'dragging' : ''} ${this.interactionMode !== 'idle' ? 'selecting' : ''}"
                style=${this._activeDrag ? `--drag-cursor: ${this._activeDrag.cursor}` : ''}
                viewBox="${this.panX} ${this.panY} ${this._svgWidth / this.zoom} ${this._svgHeight / this.zoom}"
                @wheel=${this._handleWheel}
                @pointerdown=${this._handlePointerDown}
                @pointermove=${this._handlePointerMove}
                @pointerup=${this._handlePointerUp}
                @pointercancel=${this._handlePointerUp}
                @contextmenu=${(e: MouseEvent) => e.preventDefault()}
            >
                <defs>
                    ${arrowMarkers(1.5)}
                </defs>

                ${repeat(this.model.lifelines, (ll) => ll.id, (ll, index) => {
                    const currentX = this._getLifelineX(ll.id);
                    const destroyMsg = this.model.messages.find(m => m.type === 'destroy' && m.targetId === ll.id);                  
                    let lineEndY = ll.y + ll.length;
                    if (destroyMsg) {
                        lineEndY = destroyMsg.sourceId === destroyMsg.targetId ? destroyMsg.y + 30 : destroyMsg.y;
                    } 
                    const clickAreaStartY = ll.y + 80;
                    const clickAreaHeight = Math.max(0, lineEndY - clickAreaStartY);

                    return svg`
                        <g class="lifeline ${[this._activeDrag?.id, this.messageSourceId, this.fragmentSourceId].includes(ll.id) ? 'active' : ''}" data-id="${ll.id}">
                            
                            <rect 
                                class="lifeline-click-area" 
                                x="${currentX - 35}" 
                                y="${clickAreaStartY}" 
                                width="70" 
                                height="${clickAreaHeight}" 
                                @click=${(e: MouseEvent) => this._handleLifelineClick(e, ll.id)}
                                @dblclick=${(e: MouseEvent) => this._handleLifelineDblClick(e, ll.id)}
                                @contextmenu=${(e: MouseEvent) => {e.preventDefault(); this._handleLifelineDblClick(e, ll.id)}}
                                fill="transparent"
                            />

                            <line class="lifeline-line" x1="${currentX}" y1="${ll.y + 30}" x2="${currentX}" y2="${lineEndY}" />

                            ${!destroyMsg ? svg`
                                <rect class="lifeline-handle" data-id="${ll.id}" x="${currentX - 15}" y="${ll.y + ll.length - 6}" width="30" height="12" />
                                ${this._renderResizeGrip(currentX, ll.y + ll.length)}
                            ` : ''}
                            
                            <foreignObject
                                x="${currentX - 70}"
                                y="${ll.y}"
                                width="140"
                                height="80"
                                @dblclick=${(e: MouseEvent) => this._handleLifelineDblClick(e, ll.id)}
                                @contextmenu=${(e: MouseEvent) => {e.preventDefault(); this._handleLifelineDblClick(e, ll.id)}}
                            >
                                <div xmlns="http://www.w3.org/1999/xhtml" 
                                     class="lifeline-box lifeline-click-area" 
                                     data-id="${ll.id}" 
                                >
                                    
                                    ${ll.icon && ll.icon !== 'none' && iconMap[ll.icon] ? html`
                                        <sl-icon 
                                            .src=${iconMap[ll.icon]} 
                                            style="font-size: var(--sl-font-size-2x-large); flex-shrink: 0;"
                                        ></sl-icon>
                                    ` : ''}

                                    <div class="lifeline-text-container">
                                        ${ll.stereotype ? html`
                                            <div class="stereotype-label">${ll.stereotype}</div>
                                        ` : ''}

                                        <div 
                                            class="name-label" 
                                        >${ll.name}${ll.className && ll.className.trim() !== '' ? ` : ${ll.className}` : ''}</div>
                                    </div>
                                </div>
                            </foreignObject>
                        </g>
                    `;
                })}


                ${this.model.messages.map(msg => {
                    const sourceLL = this.model.lifelines.find(l => l.id === msg.sourceId);
                    const targetLL = this.model.lifelines.find(l => l.id === msg.targetId);

                    const sourceX = this._getLifelineX(msg.sourceId);
                    const targetX = this._getLifelineX(msg.targetId);

                    const isReply = msg.type === 'reply';
                    const isAsync = msg.type === 'async';
                    const isCreate = msg.type === 'create';
                    const isDestroy = msg.type === 'destroy';
                    const isFound = msg.type === 'found';
                    const isLost = msg.type === 'lost';
                    const isSelfMessage = msg.sourceId === msg.targetId;

                    if ((!sourceLL && !isFound) || (!targetLL && !isLost)) return svg``;

                    const y = msg.y;
                    
                    const dashArray = (isReply || isCreate) ? "5, 5" : "none";
                    const markerUrl = (isAsync || isReply || isCreate) ? "url(#arrow-open)" : "url(#arrow-filled)";

                    let actualY = y;
                    if (isCreate) {
                        actualY = y+40;
                    }

                    const rightwards = isFound || isLost || isSelfMessage || sourceX < targetX;
                    const startX = isFound ? targetX - 150 : messageEndX(msg.sourceId, actualY, rightwards);
                    const endX = isLost ? sourceX + 150 : messageEndX(msg.targetId, actualY, !rightwards);

                    let actualEndX = endX;
                    if (isCreate) {
                        actualEndX = rightwards ? targetX - 70 : targetX + 70;
                    }

                    if (isSelfMessage) {
                        const loopWidth = 40;
                        const loopHeight = 30;
                        // returns to the edge of the activation bars at its end (e.g. a nested bar for the called operation)
                        const loopEndX = messageEndX(msg.sourceId, y + loopHeight, true);
                        const outerX = Math.max(sourceX + loopWidth, startX + 20, loopEndX + 20);
                        const pathD = `M ${startX} ${y} L ${outerX} ${y} L ${outerX} ${y + loopHeight} L ${loopEndX} ${y + loopHeight}`;
                        
                        return svg`
                            <g 
                                class="message ${this._activeDrag?.id === msg.id ? 'active' : ''}" 
                                data-id="${msg.id}" 
                                @dblclick=${(e: MouseEvent) => this._handleMessageDblClick(e, msg.id)}
                                @contextmenu=${(e: MouseEvent) => {e.preventDefault(); this._handleMessageDblClick(e, msg.id)}}
                            >
                                <path class="message-hitbox" d="${pathD}" />
                                <path class="message-line" 
                                      d="${pathD}" 
                                      fill="none"
                                      stroke-dasharray="${dashArray}"
                                      marker-end="${markerUrl}" />
                                
                                ${isDestroy ? svg`
                                    <g stroke="var(--sl-color-neutral-900)" stroke-width="2.5">
                                        <line x1="${sourceX - 15}" y1="${y + loopHeight - 15}" x2="${sourceX + 15}" y2="${y + loopHeight + 15}" />
                                        <line x1="${sourceX - 15}" y1="${y + loopHeight + 15}" x2="${sourceX + 15}" y2="${y + loopHeight - 15}" />
                                    </g>
                                ` : ''}
                                <text class="message-text" 
                                      x="${outerX + 10}" 
                                      y="${y + (loopHeight / 2)}" 
                                      style="text-anchor: start; dominant-baseline: middle;">
                                    ${msg.assignment ? `${msg.assignment} = ` : ''}${msg.name}
                                </text>
                            </g>
                        `;
                    } else {
                        const midX = (startX + actualEndX) / 2;

                        return svg`
                            <g 
                                class="message ${this._activeDrag?.id === msg.id ? 'active' : ''}" 
                                data-id="${msg.id}" 
                                @dblclick=${(e: MouseEvent) => this._handleMessageDblClick(e, msg.id)}
                                @contextmenu=${(e: MouseEvent) => {e.preventDefault(); this._handleMessageDblClick(e, msg.id)}}
                            >
                                <line class="message-hitbox" x1="${startX}" y1="${actualY}" x2="${actualEndX}" y2="${actualY}" />
                                ${isFound ? svg`
                                    <circle cx="${startX}" cy="${actualY}" r="4" fill="var(--sl-color-neutral-900)"/>
                                ` : ''}
                                ${isLost ? svg`
                                    <circle cx="${actualEndX}" cy="${actualY}" r="4" fill="var(--sl-color-neutral-900)"/>
                                ` : ''}
                                ${isDestroy ? svg`
                                    <g stroke="var(--sl-color-neutral-900)" stroke-width="2.5">
                                        <line x1="${targetX - 15}" y1="${actualY - 15}" x2="${targetX + 15}" y2="${actualY + 15}" />
                                        <line x1="${targetX - 15}" y1="${actualY + 15}" x2="${targetX + 15}" y2="${actualY - 15}" />
                                    </g>
                                ` : ''}
                                <line class="message-line" 
                                      x1="${startX}" y1="${actualY}" 
                                      x2="${actualEndX}" y2="${actualY}" 
                                      stroke-dasharray="${dashArray}"
                                      marker-end="${markerUrl}" />
                                <text class="message-text" x="${midX}" y="${actualY - 5}">
                                    ${msg.assignment ? `${msg.assignment} = ` : ''}${msg.name}
                                </text>
                            </g>
                        `;
                    }
                })}

                ${this.model.lifelines.map(ll => {
                    return activationBars.get(ll.id)!.map(({ activation: act, nested, x: xPos }) => {
                        const boxWidth = this.ACTIVATION_WIDTH;
                        return svg`
                            <g 
                                class="activation ${this._activeDrag?.id === act.id ? 'active' : ''}" 
                                data-id="${act.id}"
                                data-lifeline-id="${ll.id}"
                                style="
                                    --touch-outset: ${-8 / this.zoom}px;
                                    --activation-hitbox-left: ${nested ? 0 : -8 / this.zoom}px;
                                    --activation-resize-inset: ${5 - act.length / 3}px;
                                "
                                @click=${(e: MouseEvent) => this._handleLifelineClick(e, ll.id)}
                                @dblclick=${(e: MouseEvent) => this._handleActivationDblClick(e, ll.id, act.id)}
                                @contextmenu=${(e: MouseEvent) => {e.preventDefault(); this._handleActivationDblClick(e, ll.id, act.id)}}
                            >
                                <rect 
                                    class="activation-box"
                                    x="${xPos}" 
                                    y="${act.y}" 
                                    width="${boxWidth}" 
                                    height="${act.length}" 
                                    fill="var(--sl-color-neutral-0)"
                                    stroke="var(--sl-color-neutral-900)"
                                    stroke-width="1.5"
                                    style="pointer-events: none;"
                                />
                                <rect
                                    class="touch-area draggable-activation ${nested ? 'nested' : ''}"
                                    data-id="${act.id}"
                                    data-lifeline-id="${ll.id}"
                                    x="${xPos}"
                                    y="${act.y}"
                                    width="${boxWidth}"
                                    height="${act.length}"
                                />
                                ${[act.y, act.y + act.length].map((edgeY, index) => svg`
                                    <rect 
                                        class="activation-resize-handle" 
                                        data-id="${act.id}"
                                        data-lifeline-id="${ll.id}"
                                        data-edge="${index === 0 ? 'top' : 'bottom'}"
                                        x="${xPos}" 
                                        y="${edgeY - 5}" 
                                        width="${boxWidth}" 
                                        height="10" 
                                    />
                                    ${this._renderResizeGrip(xPos + boxWidth / 2, edgeY)}
                                `)}
                            </g>
                        `;
                    });
                })}

                ${(this.model.fragments || []).map(frag => {
                    const startX = this._getLifelineX(frag.startLifelineId);
                    const endX = this._getLifelineX(frag.endLifelineId);
                    
                    const minX = Math.min(startX, endX);
                    const maxX = Math.max(startX, endX);
                    
                    let leftX = minX - 85;
                    let rightX = maxX + 150;

                    const fragHeight = frag.operands.reduce((sum, op) => sum + op.height, 0);

                    let leftNestingLevel = 0;
                    let rightNestingLevel = 0;

                    const overlappingFragmentIds = this.globalSettings.isRuleActive(this.settings, 'checkForFragmentOverlap')
                        ? this._getOverlappingFragmentIds()
                        : new Set<string>();

                    (this.model.fragments || []).forEach(otherFrag => {
                        if (otherFrag.id === frag.id) return;

                        const otherStartX = this._getLifelineX(otherFrag.startLifelineId);
                        const otherEndX = this._getLifelineX(otherFrag.endLifelineId);
                        const otherMinX = Math.min(otherStartX, otherEndX);
                        const otherMaxX = Math.max(otherStartX, otherEndX);
                        
                        const otherHeight = otherFrag.operands.reduce((sum, op) => sum + op.height, 0);

                        const isVerticallyEnclosing = (otherFrag.y <= frag.y && (otherFrag.y + otherHeight) >= (frag.y + fragHeight));

                        if (isVerticallyEnclosing) {
                            if (otherMinX === minX) {
                                leftNestingLevel++;
                            }
                            if (otherMaxX === maxX) {
                                rightNestingLevel++;
                            }
                        }
                    });

                    leftX += (leftNestingLevel * 5);
                    rightX -= (rightNestingLevel * 5);

                    const boxWidth = rightX - leftX;

                    return svg`
                        <g class="fragment ${this._activeDrag?.id === frag.id ? 'active' : ''}" data-id="${frag.id}">
                            <rect 
                                class="fragment-background ${overlappingFragmentIds.has(frag.id) ? 'overlapping' : ''}"
                                x="${leftX}" 
                                y="${frag.y}" 
                                width="${boxWidth}" 
                                height="${fragHeight}" 
                                fill="transparent" 
                                stroke=${overlappingFragmentIds.has(frag.id) ? 'var(--sl-color-danger-500)' : 'black'}
                                stroke-width=${overlappingFragmentIds.has(frag.id) ? '2.5' : '1.5'}
                                style="pointer-events: none;" 
                            />

                            <path
                                class="fragment-header"
                                d="M ${leftX} ${frag.y}
                                   L ${leftX + 50} ${frag.y}
                                   L ${leftX + 60} ${frag.y + 10}
                                   L ${leftX + 60} ${frag.y + 20}
                                   L ${leftX} ${frag.y + 20} Z"
                                fill="var(--sl-color-neutral-0)"
                                stroke="var(--sl-color-neutral-900)"
                                stroke-width="1.5"
                                style="pointer-events: none;"
                            />
                            <polyline
                                class="fragment-header-fold"
                                points="${leftX + 50},${frag.y} ${leftX + 50},${frag.y + 10} ${leftX + 60},${frag.y + 10}" 
                                fill="none" 
                                stroke="var(--sl-color-neutral-900)"
                                stroke-width="1.5"
                                style="pointer-events: none;"
                            />
                            <text 
                                x="${leftX + 5}" 
                                y="${frag.y + 14}" 
                                font-family="var(--sl-font-sans)"
                                font-size="var(--sl-font-size-small)"
                                font-weight="bold" 
                                fill="var(--sl-color-neutral-900)"
                                style="pointer-events: none;"
                            >
                                ${frag.type}
                            </text>
                            <rect
                                class="touch-area fragment-header-hitbox"
                                data-id="${frag.id}"
                                x="${leftX}"
                                y="${frag.y}"
                                width="60"
                                height="20"
                                style="pointer-events: auto;"
                                @dblclick=${(e: MouseEvent) => this._editFragment(e, frag.id)}
                                @contextmenu=${(e: MouseEvent) => {e.preventDefault(); this._editFragment(e, frag.id)}}
                            />

                            <rect 
                                class="fragment-operand-resize-handle"
                                data-fragment-id="${frag.id}"
                                data-operand-id="${frag.operands[0]?.id}"
                                data-edge="top"
                                x="${leftX + 60}" 
                                y="${frag.y - 5}" 
                                width="${boxWidth - 60}" 
                                height="10" 
                                style="pointer-events: auto;"
                            />
                            ${this._renderResizeGrip(leftX + boxWidth / 2, frag.y)}

                            ${(() => {
                                let currentY = frag.y;
                                
                                return frag.operands.map((op, index) => {
                                    const isFirst = index === 0;
                                    const isLast = index === frag.operands.length - 1;
                                    
                                    const textY = isFirst ? currentY + 35 : currentY + 15;

                                    const operandSvg = svg`
                                        <g class="fragment-operand" data-id="${op.id}">
                                            <text 
                                                x="${leftX + 5}" 
                                                y="${textY}" 
                                                font-family="var(--sl-font-sans)" 
                                                font-size="var(--sl-font-size-small)" 
                                                fill="var(--sl-color-neutral-900)"
                                                style="pointer-events: none;"
                                            >
                                                ${op.guard}
                                            </text>
                                            
                                            ${!isLast ? svg`
                                                <line 
                                                    x1="${leftX}" 
                                                    y1="${currentY + op.height}" 
                                                    x2="${leftX + boxWidth}" 
                                                    y2="${currentY + op.height}" 
                                                    stroke="var(--sl-color-neutral-900)"
                                                    stroke-dasharray="8, 8" 
                                                    stroke-width="1.5" 
                                                    style="pointer-events: none;"
                                                />
                                            ` : ''}

                                            <rect 
                                                class="fragment-operand-resize-handle"
                                                data-fragment-id="${frag.id}"
                                                data-operand-id="${op.id}"
                                                x="${leftX}" 
                                                y="${currentY + op.height - 5}" 
                                                width="${boxWidth}" 
                                                height="10" 
                                                style="pointer-events: auto;"
                                            />
                                            ${this._renderResizeGrip(leftX + boxWidth / 2, currentY + op.height)}
                                        </g>
                                    `;
                                    
                                    currentY += op.height;
                                    
                                    return operandSvg;
                                });
                            })()}
                        </g>
                    `;
                })}
            </svg>

            ${this._isEmpty ? html`
                <div class="empty-hint">${msg("Add lifelines via the toolbar above.")}</div>
            ` : ''}

            <zoom-controls
                style="right: ${this._drawerShown && this.drawerPlacement === 'end' ? 'calc(33% + var(--sl-spacing-x-small))' : 'var(--sl-spacing-x-small)'};"
                .zoomLevel=${this.zoom}
                .minZoom=${0.3}
                .maxZoom=${3}
                .isFullscreen=${this.isFullscreen}
                ?zoomDisabled=${this._isEmpty}
                @zoom-in=${this._zoomIn}
                @zoom-out=${this._zoomOut}
                @fit-to-view=${this._fitToView}
            ></zoom-controls>

            <sl-drawer 
                contained
                label="${editingLifeline ? msg("Lifeline") : editingMessage ? msg("Message") : this.editingActivation ? msg("Activation") : msg("Fragment")}"
                .placement=${this.drawerPlacement}
                .open=${this.editingLifelineId !== null || this.editingMessageId !== null || this.editingActivation !== null || this.editingFragmentId !== null}
                @sl-show=${(e: Event) => { if (e.target === e.currentTarget) this._drawerShown = true; }}
                @sl-hide=${(e: Event) => { if (e.target === e.currentTarget) this._drawerShown = false; }}
                @sl-after-hide=${(e: Event) => {
                    if (e.target === e.currentTarget) {
                        this.editingLifelineId = null;
                        this.editingMessageId = null;
                        this.editingActivation = null;
                        this.editingFragmentId = null;
                        this._touchedFields = new Set<string>();
                    }
                }}
            >
                ${editingLifeline ? html`
                    <div class="drawer-content">
                        <sl-input 
                            label="${msg("Stereotype")}" 
                            value="${editingLifeline.stereotype || ''}" 
                            @sl-input=${(e: any) => this._handleLifelineUpdate('stereotype', e.target.value)}
                        ></sl-input>

                        <div style="display: flex; flex-direction: column;">
                            <sl-input 
                                label="${msg("Object Name")}"
                                value="${editingLifeline.name || ''}" 
                                @sl-input=${(e: any) => this._handleLifelineUpdate('name', e.target.value)}
                                @sl-blur=${(e: any) => { this._handleLifelineUpdate('name', e.target.value.trim()); this._handleBlur(`ll-${editingLifeline.id}-name`); }}
                                @sl-focus=${() => this._handleFocus(`ll-${editingLifeline.id}-name`)}
                                class=${shouldShowError(`ll-${editingLifeline.id}-name`) ? 'has-error' : ''}
                            ></sl-input>
                            ${shouldShowError(`ll-${editingLifeline.id}-name`) ? html`
                                <div class="validation-error">
                                    <sl-icon name="exclamation-triangle"></sl-icon> 
                                    ${shouldShowError(`ll-${editingLifeline.id}-name`)?.message}
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: flex; flex-direction: column;">
                            <sl-input 
                                label="${msg("Class Name")}"
                                value="${editingLifeline.className || ''}" 
                                @sl-input=${(e: any) => this._handleLifelineUpdate('className', e.target.value)}
                                @sl-blur=${(e: any) => { this._handleLifelineUpdate('className', e.target.value.trim()); this._handleBlur(`ll-${editingLifeline.id}-classname`); }}
                                @sl-focus=${() => this._handleFocus(`ll-${editingLifeline.id}-classname`)}
                                class=${shouldShowError(`ll-${editingLifeline.id}-classname`) ? 'has-error' : ''}
                            ></sl-input>
                            ${shouldShowError(`ll-${editingLifeline.id}-classname`) ? html`
                                <div class="validation-error">
                                    <sl-icon name="exclamation-triangle"></sl-icon> 
                                    ${shouldShowError(`ll-${editingLifeline.id}-classname`)?.message}
                                </div>
                            ` : ''}
                        </div>

                        ${this.settings.iconsInObjectBoxExists ? html`
                            <div class="icon-picker">
                                <div class="icon-picker-label" id="icon-picker-label">${msg("Icon")}</div>
                                <div class="icon-picker-grid" role="group" aria-labelledby="icon-picker-label">
                                    ${this._lifelineIconOptions().map(option => html`
                                        <sl-button
                                            class="icon-picker-option"
                                            variant=${(editingLifeline.icon || 'none') === option.value ? 'primary' : 'default'}
                                            title=${option.label}
                                            @click=${() => this._handleLifelineUpdate('icon', option.value)}
                                        >
                                            <sl-icon src=${option.src} label=${option.label}></sl-icon>
                                        </sl-button>
                                    `)}
                                </div>
                            </div>
                        ` : ''}

                        <sl-button variant="danger" outline @click=${this._handleDeleteLifelineClick}>
                            <sl-icon slot="prefix" src=${trashIcon}></sl-icon>
                            ${msg("Delete Object")}
                        </sl-button>
                    </div>
                ` : ''}

                ${editingMessage ? html`
                    <div class="drawer-content">
                        
                        <sl-input 
                            label="${msg("Assignment (variable)")}" 
                            value="${editingMessage.assignment || ''}" 
                            @sl-input=${(e: any) => this._handleMessageUpdate('assignment', e.target.value)}
                            @sl-blur=${(e: any) => { this._handleMessageUpdate('assignment', e.target.value.trim()); this._handleBlur(`msg-${editingMessage.id}-assignment`); }}
                            @sl-focus=${() => this._handleFocus(`msg-${editingMessage.id}-assignment`)}
                            class=${shouldShowError(`msg-${editingMessage.id}-assignment`) ? 'has-error' : ''}
                        ></sl-input>
                        ${shouldShowError(`msg-${editingMessage.id}-assignment`) ? html`
                            <div class="validation-error">
                                <sl-icon name="exclamation-triangle"></sl-icon> 
                                ${shouldShowError(`msg-${editingMessage.id}-assignment`)?.message}
                            </div>
                        ` : ''}

                        <div style="display: flex; flex-direction: column;">
                            <sl-input 
                                label="${msg("Message Name")}" 
                                value="${editingMessage.name || ''}" 
                                @sl-input=${(e: any) => this._handleMessageUpdate('name', e.target.value)}
                                @sl-blur=${(e: any) => { this._handleMessageUpdate('name', e.target.value.trim()); this._handleBlur(`msg-${editingMessage.id}-name`); }}
                                @sl-focus=${() => this._handleFocus(`msg-${editingMessage.id}-name`)}
                                class=${shouldShowError(`msg-${editingMessage.id}-name`) ? 'has-error' : ''}
                            ></sl-input>
                            ${shouldShowError(`msg-${editingMessage.id}-name`) ? html`
                                <div class="validation-error">
                                    <sl-icon name="exclamation-triangle"></sl-icon> 
                                    ${shouldShowError(`msg-${editingMessage.id}-name`)?.message}
                                </div>
                            ` : ''}
                        </div>

                        ${!isStructuralMessage ? html`
                            <sl-select 
                                label="${msg("Message Type")}" 
                                value="${editingMessage.type}"
                                @sl-change=${(e: any) => this._handleMessageUpdate('type', e.target.value)}
                            >
                                ${this.settings.synchronousMessageExists || editingMessage.type === 'sync' ? html`
                                    <sl-option value="sync">${msg("Synchronous")}</sl-option>
                                ` : ''}

                                ${this.settings.asynchronousMessageExists || editingMessage.type === 'async' ? html`
                                    <sl-option value="async">${msg("Asynchronous")}</sl-option>
                                ` : ''}

                                ${this.settings.replyMessageExists || editingMessage.type === 'reply' ? html`
                                    <sl-option value="reply">${msg("Reply (Return)")}</sl-option>
                                ` : ''}
                            </sl-select>
                        ` : html`
                            <sl-input label="${msg("Message Type")}" value=${editingMessage.type === 'create' ? msg("Create")
                                : editingMessage.type === 'destroy' ? msg("Destroy")
                                : editingMessage.type === 'found' ? msg("Found")
                                : msg("Lost")} disabled></sl-input>
                        `}

                        <sl-button variant="danger" outline @click=${this._handleDeleteMessageClick}>
                            <sl-icon slot="prefix" src=${trashIcon}></sl-icon>
                            ${msg("Delete Message")}
                        </sl-button>
                    </div>
                ` : ''}

                ${this.editingActivation ? html`
                    <div class="drawer-content">
                        <sl-button 
                            variant="danger" 
                            outline 
                            @click=${this._handleDeleteActivationClick}
                        >
                            <sl-icon 
                                slot="prefix" 
                                src=${trashIcon}
                            ></sl-icon>
                            ${msg("Delete Activation")}
                        </sl-button>
                    </div>
                ` : ''}

               ${this.editingFragmentId ? (() => {
                    const frag = this.model.fragments?.find(f => f.id === this.editingFragmentId);
                    if (!frag) return '';

                    return html`
                        <div class="drawer-content">
                            
                            <sl-select 
                                label=${msg("Fragment Type")} 
                                value="${frag.type}"
                                @sl-change=${(e: any) => this._handleFragmentUpdate('type', e.target.value)}
                            >
                                ${this.settings.optionalFragmentExists || frag.type === 'opt' ? html`
                                    <sl-option value="opt">${msg("Optional")} (opt)</sl-option>
                                ` : ''}
                                
                                ${this.settings.alternativeFragmentExists || frag.type === 'alt' ? html`
                                    <sl-option value="alt">${msg("Alternative")} (alt)</sl-option>
                                ` : ''}
                                
                                ${this.settings.loopFragmentExists || frag.type === 'loop' ? html`
                                    <sl-option value="loop">${msg("Loop")} (loop)</sl-option>
                                ` : ''}
                            </sl-select>

                            ${frag.operands.map((op, index) => html`
                                <div class="operand-row">
                                    <div class="operand-input-wrapper">
                                        <sl-input 
                                            label=${msg(str`Condition ${index + 1}`)}
                                            value="${op.guard}"
                                            @sl-change=${(e: any) => this._handleFragmentOperandUpdate(op.id, e.target.value)}
                                            @sl-blur=${() => this._handleBlur(`frag-${frag.id}-op-${op.id}-guard`)}
                                            @sl-focus=${() => this._handleFocus(`frag-${frag.id}-op-${op.id}-guard`)}
                                            class=${shouldShowError(`frag-${frag.id}-op-${op.id}-guard`) ? 'has-error' : ''}
                                        ></sl-input>
                                        ${shouldShowError(`frag-${frag.id}-op-${op.id}-guard`) ? html`
                                            <div class="validation-error">
                                                <sl-icon name="exclamation-triangle"></sl-icon> 
                                                ${shouldShowError(`frag-${frag.id}-op-${op.id}-guard`)?.message}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <sl-button
                                        variant="danger"
                                        outline
                                        ?disabled=${frag.operands.length <= 1}
                                        @click=${() => this._handleRemoveFragmentOperand(op.id)}
                                        title="${msg("Remove Region")}"
                                        aria-label=${msg("Remove Region")}
                                    >
                                        <sl-icon src=${xIcon}></sl-icon>
                                    </sl-button>
                                </div>
                            `)}

                            ${frag.type === 'alt' ? html`
                                <div>
                                    <sl-button 
                                        size="small" 
                                        @click=${this._handleAddFragmentRegion}
                                    >
                                        <sl-icon 
                                            slot="prefix" 
                                            src=${plusIcon}
                                        ></sl-icon>
                                        ${msg("Add Region")}
                                    </sl-button>
                                </div>
                            ` : ''}

                            <sl-button 
                                variant="danger" 
                                outline 
                                @click=${this._handleDeleteFragmentClick}
                            >
                                <sl-icon 
                                    slot="prefix" 
                                    src=${trashIcon}
                                ></sl-icon>
                                ${msg("Delete Fragment")}
                            </sl-button>
                        </div>
                    `;
                })() : ''}
            </sl-drawer>

            <confirm-dialog></confirm-dialog>
        `;
    }
}
