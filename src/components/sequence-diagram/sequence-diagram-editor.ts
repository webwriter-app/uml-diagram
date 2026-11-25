import { LitElementWw } from "@webwriter/lit";
import { widgetMsg } from "@webwriter/lit/localize";
import { SceneController } from "@webwriter/lit/scene";
import { Viewport } from "@webwriter/lit/viewport";
import { Scene, sceneElements, webglAvailable, type ActivateDetail, type BackgroundDetail, type ContextDetail, type MoveDetail, type MovingDetail, type ResizeDetail, type ResizingDetail } from "@webwriter/widget/scene";
import { PixiScene } from "@webwriter/widget/scene/pixi";
import { html, nothing, type PropertyValues } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { keyed } from "lit/directives/keyed.js";
import { property, query, state } from "lit/decorators.js";
import { str } from "@lit/localize";
import { default as SlButton } from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import { default as SlDrawer } from "@shoelace-style/shoelace/dist/components/drawer/drawer.component.js";
import { default as SlInput } from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import { default as SlIcon } from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import { default as SlSelect } from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import { default as SlOption } from "@shoelace-style/shoelace/dist/components/option/option.component.js";
import { default as SlAlert } from "@shoelace-style/shoelace/dist/components/alert/alert.component.js";
import userIcon from '@tabler/icons/outline/user.svg';
import databaseIcon from '@tabler/icons/outline/database.svg';
import serverIcon from '@tabler/icons/outline/server.svg';
import desktopIcon from '@tabler/icons/outline/device-desktop.svg';
import { repeat } from 'lit/directives/repeat.js';
import trashIcon from "@tabler/icons/outline/trash.svg";
import alertTriangleIcon from "@tabler/icons/outline/alert-triangle.svg";
import xIcon from "@tabler/icons/outline/x.svg";
import alertCircleIcon from "@tabler/icons/outline/alert-circle.svg";
import infoCircleIcon from "@tabler/icons/outline/info-circle.svg";
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
import { SequenceModel, type Fragment, type Lifeline, type SequenceMessage } from "../../model/sequence-diagram/sequence-model";
import { SequenceSettings } from "../../model/sequence-diagram/sequence-settings-model";
import {
    ACTIVATION_WIDTH, FRAGMENT_MIN_OVERLAP, HEAD_HEIGHT, HEAD_WIDTH, MIN_ACTIVATION_LENGTH, MIN_OPERAND_HEIGHT, SLOT_SPACING, START_X,
    activationBars, fragmentHeight, lifelineBounds, lifelineEnd, lifelineX, messageBounds, minLifelineLength, overlappingFragmentIds, sequenceIssues,
    type Diagram, type SequenceValidationIssue
} from "../../model/sequence-diagram/sequence-rules";
import canvasAlertStyles from "../shared/canvas-alert.styles";
import { printWebglScenes } from "../shared/print-scene";
import styles from "./sequence-diagram-editor.styles";
import { GlobalSettings } from "../../model/global-settings/global-settings-model";
import { ZoomControls } from "../zoom-controls/zoom-controls";
import { ConfirmDialog, ConfirmOptions } from "../shared/confirm-dialog";

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

type Activation = Lifeline['activations'][number];

const ZOOM_RANGE = { min: 0.3, max: 3 };
const ZOOM_STEP = 0.2;

/** Width of the area of a lifeline that takes clicks and drags */
const LIFELINE_HIT_WIDTH = 70;

/** Size of the loop of a message to the same lifeline */
const SELF_MESSAGE_WIDTH = 40;
const SELF_MESSAGE_HEIGHT = 30;

/** A height that no lifeline reaches */
const FAR = 1_000_000;

/** What the reader drags or resizes is shown by the scene while it is held; the widget only follows along where other things depend on it */
interface Preview {
    /** The lifeline that is dragged and the order the lifelines would have if it were dropped now */
    order: { id: string, ids: string[] } | null;
    /** Lifelines shown at another place or length than stored (the target of a create message that is dragged) */
    lifelines: Map<string, { y: number, length: number }>;
    /** Fragments shown at another place or height than stored, to tell at once whether they overlap */
    fragments: Map<string, { y: number, heights: Record<string, number> }>;
}

const noPreview = (): Preview => ({ order: null, lifelines: new Map(), fragments: new Map() });

/** The drag or resize that is going on: the id of the element and the cursor to show */
interface ActiveDrag {
    id: string;
    cursor: string;
}

/** Interactive editor for the Sequence Diagram */
export class SequenceEditor extends LitElementWw {
    msg = widgetMsg(this);

    /** register used elements; without WebGL the same template is drawn with SVG */
    static get scopedElements() {
        return {
            ...sceneElements,
            "ww-scene": webglAvailable() ? PixiScene : Scene,
            "sl-button": SlButton,
            "sl-drawer": SlDrawer,
            "sl-input": SlInput,
            "sl-icon": SlIcon,
            "sl-select": SlSelect,
            "sl-option": SlOption,
            "zoom-controls": ZoomControls,
            "confirm-dialog": ConfirmDialog,
            "sl-alert": SlAlert
        };
    }

    /** Pan and zoom of the canvas; an empty canvas cannot be moved */
    #viewport = new Viewport(this, {
        can: () => !this._isEmpty,
        fit: { padding: 24, maxScale: 1, follow: "window", target: () => this.#scene.extent() }
    });
    #scene = new SceneController(this, { viewport: this.#viewport.core });

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

    /** The drag in progress (moving or resizing an element): it stays highlighted while other elements show no hover state */
    @state() private accessor _activeDrag: ActiveDrag | null = null;

    /** State to store the id of the current edited activation bar */
    @state() private accessor editingActivation: { lifelineId: string, id: string } | null = null;

    /** Property to receive the settings from the main widget */
    @property({ attribute: false }) accessor settings: SequenceSettings = SequenceSettings.getInitialSequenceSettings();

    /** Store the type of the message while creating a new one */
    @property({ type: String }) accessor pendingMessageType: string = 'sync';

    /** State to store the id of the current edited message*/
    @state() private accessor editingMessageId: string | null = null;

    /** stores fields that already were in fokus previously to show validation errors */
    @state() private accessor _touchedFields = new Set<string>();

    /** Stores the field, that is currently in focus (to not show validation live) */
    @state() private accessor _focusedField: string | null = null;

    /** State to store the placement of the drawer ('start' for left, 'end' for right) */
    @state() private accessor drawerPlacement: 'start' | 'end' = 'end';

    /** Whether the drawer is shown; set at the start of its show/hide animations so the zoom controls move along with it */
    @state() private accessor _drawerShown: boolean = false;

    /** Property to store the state of the fullscreen mode */
    @property({ type: Boolean }) accessor isFullscreen: boolean = false;

    @state() private accessor _notice: string | null = null;

    /** Counts shown notices, so every notice gets its own alert (which restarts its auto-hide timer) */
    @state() private accessor _noticeCount = 0;

    @query("confirm-dialog") private accessor _confirmDialog!: ConfirmDialog;

    /** Global settings instance passed down from the main widget */
    @property({ attribute: false }) accessor globalSettings: GlobalSettings = GlobalSettings.getInitialGlobalSettings();

    #preview = noPreview();

    /** Aborting it removes the listeners of the print view */
    #printing?: AbortController;

    /** styles are defined in the editor.styles */
    static styles = [styles, canvasAlertStyles];

    // --------------------------------------------------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------------------------------------------------

    connectedCallback() {
        super.connectedCallback();
        this.#printing = new AbortController();
        printWebglScenes(this, this.#printing.signal, this.#viewport);
    }

    disconnectedCallback() {
        this.#printing?.abort();
        super.disconnectedCallback();
    }

    protected willUpdate(changedProperties: PropertyValues) {
        super.willUpdate(changedProperties);
        if (changedProperties.has('model')) {
            const { lifelines, messages, fragments = [] } = this.model;
            if (this.editingLifelineId && !lifelines.some(lifeline => lifeline.id === this.editingLifelineId)) this.editingLifelineId = null;
            if (this.editingMessageId && !messages.some(message => message.id === this.editingMessageId)) this.editingMessageId = null;
            if (this.editingFragmentId && !fragments.some(fragment => fragment.id === this.editingFragmentId)) this.editingFragmentId = null;
            const activation = this.editingActivation;
            if (activation && !lifelines.find(lifeline => lifeline.id === activation.lifelineId)?.activations?.some(item => item.id === activation.id)) {
                this.editingActivation = null;
            }
        }
        if (changedProperties.has('interactionMode') && this.interactionMode !== 'idle') {
            this._notice = null;
        }
    }

    protected updated(changedProperties: PropertyValues) {
        super.updated(changedProperties);
        // An empty canvas is reset to its initial view
        const view = this.#viewport;
        if (this._isEmpty && (view.x !== 0 || view.y !== 0 || view.scale !== 1)) view.fit();
    }

    /** Without any lifelines there is no reference point, so the canvas cannot be panned or zoomed */
    private get _isEmpty(): boolean {
        return !this.model?.lifelines?.length;
    }

    public async showNotice(message: string) {
        this._notice = message;
        this._noticeCount++;
        await this.updateComplete;
        (this.shadowRoot?.querySelector(".canvas-alert sl-alert") as SlAlert | null)?.show();
    }

    public confirm(options: ConfirmOptions): Promise<boolean> {
        return this._confirmDialog.confirm(options);
    }

    // --------------------------------------------------------------------------------------------------------
    // Zoom
    // --------------------------------------------------------------------------------------------------------

    /** Zoom in or out by a step, around the middle of the view, within the limits of the zoom */
    private _zoomBy(step: number) {
        this.#viewport.zoomTo(Math.min(Math.max(this.#viewport.scale + step, ZOOM_RANGE.min), ZOOM_RANGE.max));
    }

    // --------------------------------------------------------------------------------------------------------
    // What the reader does in the scene
    // --------------------------------------------------------------------------------------------------------

    /** What is shown while something is dragged: lifelines moved to other slots and the fragments as they would be */
    private get _shown() {
        const preview = this.#preview;
        const lifelines = this.model.lifelines.map(ll => preview.lifelines.has(ll.id) ? { ...ll, ...preview.lifelines.get(ll.id) } : ll);
        const fragments = (this.model.fragments || []).map(frag => {
            const own = preview.fragments.get(frag.id);
            return own ? { ...frag, y: own.y, operands: frag.operands.map(op => ({ ...op, height: own.heights[op.id] ?? op.height })) } : frag;
        });
        return { lifelines, messages: this.model.messages, fragments };
    }

    /** The slot a lifeline would be dropped in when its box is at x */
    private _slotAt(x: number): number {
        const index = Math.round((x - (START_X - HEAD_WIDTH / 2)) / SLOT_SPACING);
        return Math.max(0, Math.min(index, this.model.lifelines.length - 1));
    }

    #changePreview(change: (preview: Preview) => void, active: ActiveDrag | null) {
        change(this.#preview);
        this._activeDrag = active;
        this.requestUpdate();
    }

    #endPreview() {
        this.#preview = noPreview();
        this._activeDrag = null;
        this.requestUpdate();
    }

    /** While something is dragged, what depends on it follows: the other lifelines take their slots, the box of a created lifeline moves, overlapping fragments are marked */
    #onMoving(event: CustomEvent<MovingDetail>) {
        const { state, items } = event.detail;
        if (state === 'end') return this.#endPreview();
        const { key, x, y } = items[0];
        const [kind, id, subId] = key.split(':');
        const active = { id: subId ?? id, cursor: 'grabbing' };
        if (kind === 'l') {
            const ids = this.model.lifelines.map(ll => ll.id).filter(other => other !== id);
            ids.splice(this._slotAt(x), 0, id);
            this.#changePreview(preview => { preview.order = { id, ids }; }, active);
        } else if (kind === 'm') {
            const message = this.model.messages.find(m => m.id === id);
            const target = message?.type === 'create' ? this.model.lifelines.find(ll => ll.id === message.targetId) : undefined;
            this.#changePreview(preview => {
                if (target) preview.lifelines.set(target.id, { y, length: Math.max(0, target.y + target.length - y) });
            }, active);
        } else if (kind === 'f') {
            this.#changePreview(preview => { preview.fragments.set(id, { y, heights: {} }); }, active);
        } else {
            this._activeDrag = active;
        }
    }

    /** The drops: a lifeline takes its slot, the others change the place of what was dragged */
    #onMove(event: CustomEvent<MoveDetail>) {
        for (const { key, x, y } of event.detail.items) {
            const [kind, id, subId] = key.split(':');
            if (kind === 'l') {
                const shift = this._slotAt(x) - this.model.lifelines.findIndex(ll => ll.id === id);
                if (shift !== 0) this.dispatchEvent(new CustomEvent('reorder-lifeline', { detail: { id, shift } }));
            } else if (kind === 'm') {
                this.dispatchEvent(new CustomEvent('update-message', { detail: { id, y } }));
                const message = this.model.messages.find(m => m.id === id);
                const target = message?.type === 'create' ? this.model.lifelines.find(ll => ll.id === message.targetId) : undefined;
                if (target) {
                    this.dispatchEvent(new CustomEvent('update-lifeline', {
                        detail: { id: target.id, y, length: Math.max(0, target.y + target.length - y) }
                    }));
                }
            } else if (kind === 'a') {
                this.dispatchEvent(new CustomEvent('update-activation', { detail: { lifelineId: id, activationId: subId, y } }));
            } else if (kind === 'f') {
                this.dispatchEvent(new CustomEvent('update-fragment', { detail: { id, y } }));
            }
        }
    }

    /** While a fragment is resized, the others learn at once whether it overlaps them */
    #onResizing(event: CustomEvent<ResizingDetail>) {
        const { state, key, y, height } = event.detail;
        if (state === 'end') return this.#endPreview();
        const [kind, id, subId] = key.split(':');
        if (kind !== 'fo') {
            this._activeDrag = { id: kind === 'ar' ? subId : id, cursor: 'ns-resize' };
            return;
        }
        const fragment = this.model.fragments?.find(f => f.id === id);
        if (!fragment) return;
        const first = fragment.operands[0]?.id === subId;
        this.#changePreview(preview => {
            preview.fragments.set(id, { y: first ? fragment.y + y : fragment.y, heights: { [subId]: height } });
        }, { id, cursor: 'ns-resize' });
    }

    /** The end of a resize: the length of a lifeline, of an activation bar or of the regions of a fragment */
    #onResize(event: CustomEvent<ResizeDetail>) {
        const { key, y, height } = event.detail;
        const [kind, id, subId] = key.split(':');
        if (kind === 'lb') {
            this.dispatchEvent(new CustomEvent('update-lifeline', { detail: { id, length: HEAD_HEIGHT + height } }));
        } else if (kind === 'ar') {
            const activation = this.model.lifelines.find(ll => ll.id === id)?.activations?.find(act => act.id === subId);
            if (activation) this.dispatchEvent(new CustomEvent('update-activation', { detail: { lifelineId: id, activationId: subId, y: activation.y + y, length: height } }));
        } else if (kind === 'fo') {
            const fragment = this.model.fragments?.find(f => f.id === id);
            if (!fragment) return;
            const first = fragment.operands[0]?.id === subId;
            this.dispatchEvent(new CustomEvent('update-fragment', {
                detail: {
                    id,
                    y: first ? fragment.y + y : fragment.y,
                    operands: fragment.operands.map(op => ({ ...op, height: op.id === subId ? height : op.height }))
                }
            }));
        }
    }

    /** A double click, or Enter on a focused element, opens the drawer of what was pressed */
    #onActivate(event: CustomEvent<ActivateDetail>) {
        const { hit, item, count, via, pointer } = event.detail;
        const target = hit ?? item;
        if (this.interactionMode !== 'idle' || !target || (count !== 2 && via !== 'keyboard')) return;
        const [kind, id, subId] = target.key.split(':');
        this.#openDrawer(kind, id, subId, pointer?.clientX);
    }

    /**
     * While a lifeline is picked (to add a message, an activation or a fragment) nothing is moved, so a click
     * reaches the scene as a click on its background: the lifeline is the one whose line area it is in
     */
    #onBackground(event: CustomEvent<BackgroundDetail>) {
        if (this.interactionMode === 'idle' || event.detail.gesture !== 'click') return;
        const { x, y } = event.detail.point;
        const picked = this.model.lifelines.find(ll =>
            Math.abs(x - lifelineX(this.model, ll.id)) <= LIFELINE_HIT_WIDTH / 2 && y >= ll.y + HEAD_HEIGHT && y <= lifelineEnd(this.model, ll));
        if (picked) this._handleLifelineClick(picked.id, y);
    }

    /** The menu of an element is its drawer (also by long press with a finger) */
    #onContext(event: CustomEvent<ContextDetail>) {
        event.preventDefault();
        if (event.detail.kind === 'background' || this.interactionMode !== 'idle') return;
        const [kind, id, subId] = event.detail.hit!.key.split(':');
        this.#openDrawer(kind, id, subId, event.detail.point.clientX);
    }

    // --------------------------------------------------------------------------------------------------------
    // Core Helpers and Global Interaction
    // --------------------------------------------------------------------------------------------------------

    /**
     * Handles what happens by a click on a lifeline depending on the interaction mode:
     * where to add an activity bar (id of liveline and y coordinate)
     * where to start a fragment (livelineId and y coordingate)
     * where to end a fragment (livelineId and y coordinate)
     * where to start and end a message (liveline id and y coordinate)
     * for each the end y coordinate is relevant in the end
     */
    private _handleLifelineClick(id: string, clickY: number) {
        if (this.interactionMode === 'idle') return;
        const model = this.model;

        // activities
        if (this.interactionMode === 'add-activation') {
            const { minY, maxY } = lifelineBounds(model, id);
            const DEFAULT_LENGTH = 60;

            if (clickY < minY || clickY >= maxY) {
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            const safeLength = Math.min(DEFAULT_LENGTH, maxY - clickY);

            if (safeLength < MIN_ACTIVATION_LENGTH) {
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            this.dispatchEvent(new CustomEvent('add-activation-at', {
                detail: { id: id, y: clickY, length: safeLength }
            }));
            return;
        }

        // fragment (start)
        if (this.interactionMode === 'creating-fragment-start') {
            const { minY, maxY } = lifelineBounds(model, id);

            const safeMaxY = maxY - FRAGMENT_MIN_OVERLAP;
            if (minY > safeMaxY) {
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            const clampedY = Math.max(minY, Math.min(clickY, safeMaxY));

            this.dispatchEvent(new CustomEvent('select-fragment-source', {
                detail: { id, y: clampedY }
            }));
            return;
        }

        // fragment (end)
        if (this.interactionMode === 'creating-fragment-end') {
            this.dispatchEvent(new CustomEvent('select-fragment-target', {
                detail: { id, y: clickY }
            }));
            return;
        }

        // message
        if (this.interactionMode === 'add-message-source') {

            // for "lost" and "create-new" the first click is already the final click
            if (this.pendingMessageType === 'lost' || this.pendingMessageType === 'create-new') {
                const mappedType = this.pendingMessageType === 'create-new' ? 'create' : 'lost';
                const bounds = messageBounds(model, id, 'external', mappedType);

                if (clickY < bounds.minY || clickY > bounds.maxY) {
                    this.showNotice(this.msg("Message cannot be placed here (outside of logical boundaries)."));
                    this.dispatchEvent(new CustomEvent('cancel-interaction'));
                    return;
                }
            }

            this.dispatchEvent(new CustomEvent('select-source', { detail: { id, y: clickY } }));

        } else if (this.interactionMode === 'add-message-target') {
            const mappedType = this.pendingMessageType === 'create-existing' ? 'create' : this.pendingMessageType;
            const source = this.messageSourceId === 'external' ? 'external' : this.messageSourceId!;

            if (mappedType === 'create' && source === id) {
                this.showNotice(this.msg("An object cannot create itself (self-create is not allowed)."));
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            const bounds = messageBounds(model, source, id, mappedType);

            if (clickY < bounds.minY || clickY > bounds.maxY) {
                this.showNotice(this.msg("Message cannot be placed here (outside of logical boundaries or inside the name box)."));
                this.dispatchEvent(new CustomEvent('cancel-interaction'));
                return;
            }

            this.dispatchEvent(new CustomEvent('select-target', { detail: { id, y: clickY } }));
        }
    }

    // --------------------------------------------------------------------------------------------------------
    // Drawer: what is edited
    // --------------------------------------------------------------------------------------------------------

    /** Determines if the drawer should open on the left or right based on the position of the click */
    private _setDrawerPlacement(clientX: number | undefined) {
        const rect = this.getBoundingClientRect();
        this.drawerPlacement = (clientX ?? rect.left + rect.width / 2) < rect.left + rect.width / 2 ? 'end' : 'start';
    }

    /** Closes the other drawer menus and opens the one of a lifeline, message, activation or fragment that was pressed twice or opened by the context menu */
    #openDrawer(kind: string, id: string, subId: string | undefined, clientX: number | undefined) {
        const edit = {
            lifeline: kind === 'lh' || kind === 'lb',
            message: kind === 'mp',
            activation: kind === 'ar',
            fragment: kind === 'fh'
        };
        if (!Object.values(edit).includes(true)) return;
        this._setDrawerPlacement(clientX);
        this.editingLifelineId = edit.lifeline ? id : null;
        this.editingMessageId = edit.message ? id : null;
        this.editingActivation = edit.activation ? { lifelineId: id, id: subId! } : null;
        this.editingFragmentId = edit.fragment ? id : null;
    }

    // --------------------------------------------------------------------------------------------------------
    // Lifelines/Objects (Drawer)
    // --------------------------------------------------------------------------------------------------------

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
            { value: 'none', label: this.msg("No icon"), src: noIcon },
            { value: 'user', label: this.msg("User"), src: iconMap['user'] },
            { value: 'users', label: this.msg("Users"), src: iconMap['users'] },
            { value: 'device-desktop', label: this.msg("Desktop"), src: iconMap['device-desktop'] },
            { value: 'device-mobile', label: this.msg("Mobile"), src: iconMap['device-mobile'] },
            { value: 'world', label: this.msg("Globe"), src: iconMap['world'] },
            { value: 'server', label: this.msg("Server"), src: iconMap['server'] },
            { value: 'cloud', label: this.msg("Cloud"), src: iconMap['cloud'] },
            { value: 'database', label: this.msg("Database"), src: iconMap['database'] },
            { value: 'api', label: this.msg("API"), src: iconMap['api'] },
            { value: 'settings', label: this.msg("Gear"), src: iconMap['settings'] },
            { value: 'lock', label: this.msg("Lock"), src: iconMap['lock'] },
            { value: 'mail', label: this.msg("Mail"), src: iconMap['mail'] },
            { value: 'file', label: this.msg("File"), src: iconMap['file'] },
            { value: 'clock', label: this.msg("Clock"), src: iconMap['clock'] },
            { value: 'credit-card', label: this.msg("Credit Card"), src: iconMap['credit-card'] },
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
    // Validation
    // --------------------------------------------------------------------------------------------------------

    /** The rules the active settings switch on */
    private get _activeIssues(): SequenceValidationIssue[] {
        if (!this.model || this.globalSettings.validationMode === 'off') return [];

        const allIssues = sequenceIssues(this.model, this.msg);
        if (this.globalSettings.validationMode === 'all') return allIssues;

        // only the custom validations are wanted
        return allIssues.filter(issue => (this.settings as any)[issue.settingKey] === true);
    }

    // --------------------------------------------------------------------------------------------------------
    // Rendering
    // --------------------------------------------------------------------------------------------------------

    /** The box of a lifeline: its name, which can be dragged to another slot, and the line below it */
    #renderLifeline(ll: Lifeline, x: number, shown: Diagram, idle: boolean) {
        const destroyed = shown.messages.some(m => m.type === 'destroy' && m.targetId === ll.id);
        const lineEnd = lifelineEnd(shown, ll) - ll.y;
        const bodyHeight = Math.max(0, lineEnd - HEAD_HEIGHT);
        const active = [this._activeDrag?.id, this.messageSourceId, this.fragmentSourceId].includes(ll.id);

        return html`
            <ww-group data-ww-key="l:${ll.id}" x=${x - HEAD_WIDTH / 2} y=${ll.y} ?movable=${idle} axis="x">
                <ww-path class=${classMap({ 'lifeline-line': true, active })} .points=${[{ x: HEAD_WIDTH / 2, y: 30 }, { x: HEAD_WIDTH / 2, y: lineEnd }]}></ww-path>
                <ww-shape
                    class="lifeline-body"
                    data-ww-key="lb:${ll.id}"
                    kind="rect"
                    x=${(HEAD_WIDTH - LIFELINE_HIT_WIDTH) / 2}
                    y=${HEAD_HEIGHT}
                    width=${LIFELINE_HIT_WIDTH}
                    height=${bodyHeight}
                    resizable=${destroyed ? nothing : 's'}
                    ?selected=${idle && !destroyed}
                    min-height=${minLifelineLength(this.model, ll) - HEAD_HEIGHT}
                ></ww-shape>
                <ww-node data-ww-key="lh:${ll.id}" class=${classMap({ 'lifeline-box': true, active })} x="0" y="0">
                    ${ll.icon && ll.icon !== 'none' && iconMap[ll.icon] ? html`
                        <sl-icon .src=${iconMap[ll.icon]} style="font-size: var(--sl-font-size-2x-large); flex-shrink: 0;"></sl-icon>
                    ` : nothing}
                    <div class="lifeline-text-container">
                        ${ll.stereotype ? html`<div class="stereotype-label">${ll.stereotype}</div>` : nothing}
                        <div class="name-label">${ll.name}${ll.className && ll.className.trim() !== '' ? ` : ${ll.className}` : ''}</div>
                    </div>
                </ww-node>
            </ww-group>`;
    }

    /** A message: an arrow at one height between two lifelines, which can only be dragged up and down */
    #renderMessage(msg: SequenceMessage, shown: Diagram, idle: boolean, slot: (id: string) => number, endX: (lifelineId: string, y: number, rightEdge: boolean) => number) {
        const sourceLL = shown.lifelines.find(l => l.id === msg.sourceId);
        const targetLL = shown.lifelines.find(l => l.id === msg.targetId);

        const isReply = msg.type === 'reply';
        const isAsync = msg.type === 'async';
        const isCreate = msg.type === 'create';
        const isDestroy = msg.type === 'destroy';
        const isFound = msg.type === 'found';
        const isLost = msg.type === 'lost';
        const isSelfMessage = msg.sourceId === msg.targetId;

        if ((!sourceLL && !isFound) || (!targetLL && !isLost)) return nothing;

        const sourceX = slot(msg.sourceId);
        const targetX = slot(msg.targetId);
        const y = msg.y;
        // a create message stores the top of the new box; its arrow is 40px below
        const lineY = isCreate ? 40 : 0;
        const actualY = y + lineY;

        const rightwards = isFound || isLost || isSelfMessage || sourceX < targetX;
        const startX = isFound ? targetX - 150 : endX(msg.sourceId, actualY, rightwards);
        const endsX = isLost ? sourceX + 150 : endX(msg.targetId, actualY, !rightwards);
        const lineEndX = isCreate ? (rightwards ? targetX - 70 : targetX + 70) : endsX;

        const bounds = messageBounds(this.model, msg.sourceId, msg.targetId, msg.type, msg.id);
        const label = `${msg.assignment ? `${msg.assignment} = ` : ''}${msg.name}`;
        const points = isSelfMessage ? [] : [{ x: startX, y: 0 }, { x: lineEndX, y: 0 }];
        let at = 0.5;
        if (isSelfMessage) {
            // returns to the edge of the activation bars at its end (e.g. a nested bar for the called operation)
            const loopEndX = endX(msg.sourceId, y + SELF_MESSAGE_HEIGHT, true);
            const outerX = Math.max(sourceX + SELF_MESSAGE_WIDTH, startX + 20, loopEndX + 20);
            points.push({ x: startX, y: 0 }, { x: outerX, y: 0 }, { x: outerX, y: SELF_MESSAGE_HEIGHT }, { x: loopEndX, y: SELF_MESSAGE_HEIGHT });
            // the text stands beside the middle of the vertical part
            const first = outerX - startX;
            at = (first + SELF_MESSAGE_HEIGHT / 2) / (first + SELF_MESSAGE_HEIGHT + outerX - loopEndX);
        }
        const cross = (x: number, centreY: number) => html`
            <ww-path class="destroy-cross" .points=${[{ x: x - 15, y: centreY - 15 }, { x: x + 15, y: centreY + 15 }]}></ww-path>
            <ww-path class="destroy-cross" .points=${[{ x: x - 15, y: centreY + 15 }, { x: x + 15, y: centreY - 15 }]}></ww-path>`;
        const dot = (x: number) => html`<ww-shape class="message-dot" kind="circle" x=${x} y=${lineY} r="4"></ww-shape>`;

        return html`
            <ww-group
                data-ww-key="m:${msg.id}"
                y=${y}
                ?movable=${idle && bounds.minY <= bounds.maxY}
                axis="y"
                min-y=${ifDefined(Number.isFinite(bounds.minY) ? bounds.minY : undefined)}
                max-y=${ifDefined(Number.isFinite(bounds.maxY) ? bounds.maxY : undefined)}
            >
                <ww-path
                    class=${classMap({ 'message-line': true, dashed: isReply || isCreate, active: this._activeDrag?.id === msg.id })}
                    data-ww-key="mp:${msg.id}"
                    y=${lineY}
                    .points=${points}
                    marker-end=${(isAsync || isReply || isCreate) ? 'open-arrow' : 'triangle-filled'}
                    hit-width="20"
                >
                    <ww-text class="message-text" at=${isSelfMessage ? at : 'middle'} side=${isSelfMessage ? 'left' : 'above'} gap="2">${label}</ww-text>
                </ww-path>
                ${isFound ? dot(startX) : nothing}
                ${isLost ? dot(lineEndX) : nothing}
                ${isDestroy ? cross(isSelfMessage ? sourceX : targetX, isSelfMessage ? SELF_MESSAGE_HEIGHT : 0) : nothing}
            </ww-group>`;
    }

    /** An activation bar: moves along its lifeline and is resized at both ends */
    #renderActivation(llId: string, bar: { activation: Activation, nested: boolean, x: number }, idle: boolean) {
        const { activation, x } = bar;
        const { minY, maxY } = lifelineBounds(this.model, llId);
        const active = this._activeDrag?.id === activation.id;
        return html`
            <ww-group
                data-ww-key="a:${llId}:${activation.id}"
                x=${x}
                y=${activation.y}
                ?movable=${idle && activation.length <= maxY - minY}
                axis="y"
                min-y=${minY}
                max-y=${maxY - activation.length}
            >
                <ww-shape
                    class=${classMap({ 'activation-box': true, active })}
                    data-ww-key="ar:${llId}:${activation.id}"
                    kind="rect"
                    x="0"
                    y="0"
                    width=${ACTIVATION_WIDTH}
                    height=${activation.length}
                    resizable="n s"
                    ?selected=${idle}
                    min-height=${MIN_ACTIVATION_LENGTH}
                    bounds="0 ${minY - activation.y} ${ACTIVATION_WIDTH} ${Math.max(0, maxY - minY)}"
                ></ww-shape>
            </ww-group>`;
    }

    /** A fragment: moves up and down by its header, and its regions are resized at their lower edges (the first one also at its upper) */
    #renderFragment(frag: Fragment, overlapping: Set<string>, idle: boolean, slot: (id: string) => number) {
        const startX = slot(frag.startLifelineId);
        const endX = slot(frag.endLifelineId);
        const height = fragmentHeight(frag);
        let leftX = Math.min(startX, endX) - 85;
        let rightX = Math.max(startX, endX) + 150;

        // fragments that enclose this one narrow it, so that their frames stay apart
        let leftNestingLevel = 0;
        let rightNestingLevel = 0;
        for (const other of this.model.fragments || []) {
            if (other.id === frag.id) continue;
            const otherStartX = slot(other.startLifelineId);
            const otherEndX = slot(other.endLifelineId);
            if (other.y <= frag.y && other.y + fragmentHeight(other) >= frag.y + height) {
                if (Math.min(otherStartX, otherEndX) === Math.min(startX, endX)) leftNestingLevel++;
                if (Math.max(otherStartX, otherEndX) === Math.max(startX, endX)) rightNestingLevel++;
            }
        }
        leftX += leftNestingLevel * 5;
        rightX -= rightNestingLevel * 5;
        const boxWidth = rightX - leftX;
        const overlaps = overlapping.has(frag.id);
        const { minY, maxY } = lifelineBounds(this.model, frag.startLifelineId);

        let offset = 0;
        return html`
            <ww-group
                data-ww-key="f:${frag.id}"
                x=${leftX}
                y=${frag.y}
                ?movable=${idle && minY <= maxY - FRAGMENT_MIN_OVERLAP}
                axis="y"
                min-y=${minY}
                max-y=${maxY - FRAGMENT_MIN_OVERLAP}
            >
                <ww-shape class=${classMap({ 'fragment-background': true, overlapping: overlaps, active: this._activeDrag?.id === frag.id })} kind="rect" x="0" y="0" width=${boxWidth} height=${height}></ww-shape>
                <ww-shape class=${classMap({ 'fragment-header': true, active: this._activeDrag?.id === frag.id })} data-ww-key="fh:${frag.id}" kind="polygon" points="0,0 50,0 60,10 60,20 0,20"></ww-shape>
                <ww-path class="fragment-header-fold" .points=${[{ x: 50, y: 0 }, { x: 50, y: 10 }, { x: 60, y: 10 }]}></ww-path>
                <ww-text class="fragment-type" x="5" y="14">${frag.type}</ww-text>
                ${frag.operands.map((op, index) => {
                    const top = offset;
                    offset += op.height;
                    return html`
                        <ww-shape
                            class="fragment-operand"
                            data-ww-key="fo:${frag.id}:${op.id}"
                            kind="rect"
                            x="0"
                            y=${top}
                            width=${boxWidth}
                            height=${op.height}
                            resizable=${index === 0 ? 'n s' : 's'}
                            ?selected=${idle}
                            min-height=${MIN_OPERAND_HEIGHT}
                            bounds=${index === 0 ? `0 ${minY - frag.y} ${boxWidth} ${FAR}` : nothing}
                        ></ww-shape>
                        <ww-text class="fragment-guard" x="5" y=${top + (index === 0 ? 35 : 15)}>${op.guard}</ww-text>
                        ${index < frag.operands.length - 1 ? html`
                            <ww-path class="fragment-divider" .points=${[{ x: 0, y: top + op.height }, { x: boxWidth, y: top + op.height }]}></ww-path>
                        ` : nothing}`;
                })}
            </ww-group>`;
    }

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

        const idle = this.interactionMode === 'idle';
        const shown = this._shown;
        const order = this.#preview.order?.ids;
        const dragged = this.#preview.order?.id;
        // where the lifelines are: the slots they would have after the drop of the lifeline that is dragged
        const slot = (id: string) => lifelineX(this.model, id, order);

        const bars = new Map(shown.lifelines.map(ll => [ll.id, activationBars(ll, slot(ll.id))]));

        // messages start and end at the edges of the activation bars active at their height (the right edge if
        // they continue to the right) instead of running underneath them, or at the lifeline if there are none
        const messageEndX = (lifelineId: string, y: number, rightEdge: boolean) => {
            const active = (bars.get(lifelineId) || [])
                .filter(({ activation }) => y >= activation.y && y <= activation.y + activation.length);
            if (active.length === 0) return slot(lifelineId);
            return rightEdge
                ? Math.max(...active.map(bar => bar.x + ACTIVATION_WIDTH))
                : Math.min(...active.map(bar => bar.x));
        };

        const overlapping = this.settings.checkForFragmentOverlap && this.globalSettings.validationMode !== 'off'
            ? overlappingFragmentIds(shown)
            : new Set<string>();

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

        const view = this.#viewport;

        return html`
            ${this._notice ? keyed(this._noticeCount, html`
                <div class="canvas-alert">
                    <sl-alert
                        variant="danger"
                        duration="5000"
                        closable
                        @sl-after-hide=${(e: Event) => { if (e.target === e.currentTarget) this._notice = null; }}
                    >
                        <sl-icon slot="icon" src=${alertCircleIcon}></sl-icon>
                        <span class="canvas-alert-text">${this._notice}</span>
                    </sl-alert>
                </div>
            `) : this.interactionMode !== 'idle' ? html`
                <div class="canvas-alert">
                    <sl-alert
                        variant="primary"
                        closable
                        open
                        @sl-hide=${(e: Event) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('cancel-interaction')); }}
                    >
                        <sl-icon slot="icon" src=${infoCircleIcon}></sl-icon>
                        <span>
                            ${this.interactionMode === 'add-message-source'
                                ? this.msg("Select sending lifeline")
                                : this.interactionMode === 'add-activation'
                                ? this.msg("Select a lifeline")
                                : this.interactionMode === 'creating-fragment-start'
                                ? this.msg("Select start lifeline")
                                : this.interactionMode === 'creating-fragment-end'
                                ? this.msg("Select end lifeline")
                                : this.msg("Select receiving lifeline")}
                        </span>
                    </sl-alert>
                </div>
            ` : ''}

            <ww-scene
                id="canvas"
                class=${classMap({ empty: this._isEmpty, dragging: !!this._activeDrag })}
                style=${this._activeDrag ? `--drag-cursor: ${this._activeDrag.cursor}` : ''}
                select="none"
                data-ww-viewport="canvas"
                data-ww-viewport-fit="content"
                data-ww-viewport-wheel="zoom"
                data-ww-viewport-zoom="${ZOOM_RANGE.min} ${ZOOM_RANGE.max}"
                background="dots"
                background-spacing="40"
                @ww-ready=${() => this.#viewport.fit()}
                @ww-move=${this.#onMove}
                @ww-moving=${this.#onMoving}
                @ww-resize=${this.#onResize}
                @ww-resizing=${this.#onResizing}
                @ww-activate=${this.#onActivate}
                @ww-context=${this.#onContext}
                @ww-background=${this.#onBackground}
            >
                ${repeat(shown.lifelines, ll => ll.id, ll => this.#renderLifeline(ll, ll.id === dragged ? lifelineX(this.model, ll.id) : slot(ll.id), shown, idle))}
                ${repeat(shown.messages, msg => msg.id, msg => this.#renderMessage(msg, shown, idle, slot, messageEndX))}
                ${shown.lifelines.map(ll => bars.get(ll.id)!.map(bar => this.#renderActivation(ll.id, bar, idle)))}
                ${(this.model.fragments || []).map(frag => this.#renderFragment(frag, overlapping, idle, slot))}
            </ww-scene>

            ${this._isEmpty ? html`
                <div class="empty-hint">${this.msg("Add lifelines via the toolbar above.")}</div>
            ` : ''}

            <zoom-controls
                style="right: ${this._drawerShown && this.drawerPlacement === 'end' ? 'calc(33% + var(--sl-spacing-x-small))' : 'var(--sl-spacing-x-small)'};"
                .zoomLevel=${view.scale}
                .minZoom=${ZOOM_RANGE.min}
                .maxZoom=${ZOOM_RANGE.max}
                .isFullscreen=${this.isFullscreen}
                ?zoomDisabled=${this._isEmpty}
                @zoom-in=${() => this._zoomBy(ZOOM_STEP)}
                @zoom-out=${() => this._zoomBy(-ZOOM_STEP)}
                @fit-to-view=${() => this.#viewport.fit()}
            ></zoom-controls>

            <sl-drawer 
                contained
                label="${editingLifeline ? this.msg("Lifeline") : editingMessage ? this.msg("Message") : this.editingActivation ? this.msg("Activation") : this.msg("Fragment")}"
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
                            label="${this.msg("Stereotype")}"
                            value="${editingLifeline.stereotype || ''}" 
                            @sl-input=${(e: any) => this._handleLifelineUpdate('stereotype', e.target.value)}
                        ></sl-input>

                        <div style="display: flex; flex-direction: column;">
                            <sl-input 
                                label="${this.msg("Object Name")}"
                                value="${editingLifeline.name || ''}" 
                                @sl-input=${(e: any) => this._handleLifelineUpdate('name', e.target.value)}
                                @sl-blur=${(e: any) => { this._handleLifelineUpdate('name', e.target.value.trim()); this._handleBlur(`ll-${editingLifeline.id}-name`); }}
                                @sl-focus=${() => this._handleFocus(`ll-${editingLifeline.id}-name`)}
                                class=${shouldShowError(`ll-${editingLifeline.id}-name`) ? 'has-error' : ''}
                            ></sl-input>
                            ${shouldShowError(`ll-${editingLifeline.id}-name`) ? html`
                                <div class="validation-error">
                                    <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                    ${shouldShowError(`ll-${editingLifeline.id}-name`)?.message}
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: flex; flex-direction: column;">
                            <sl-input 
                                label="${this.msg("Class Name")}"
                                value="${editingLifeline.className || ''}" 
                                @sl-input=${(e: any) => this._handleLifelineUpdate('className', e.target.value)}
                                @sl-blur=${(e: any) => { this._handleLifelineUpdate('className', e.target.value.trim()); this._handleBlur(`ll-${editingLifeline.id}-classname`); }}
                                @sl-focus=${() => this._handleFocus(`ll-${editingLifeline.id}-classname`)}
                                class=${shouldShowError(`ll-${editingLifeline.id}-classname`) ? 'has-error' : ''}
                            ></sl-input>
                            ${shouldShowError(`ll-${editingLifeline.id}-classname`) ? html`
                                <div class="validation-error">
                                    <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                    ${shouldShowError(`ll-${editingLifeline.id}-classname`)?.message}
                                </div>
                            ` : ''}
                        </div>

                        ${this.settings.iconsInObjectBoxExists ? html`
                            <div class="icon-picker">
                                <div class="icon-picker-label" id="icon-picker-label">${this.msg("Icon")}</div>
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
                            ${this.msg("Delete Object")}
                        </sl-button>
                    </div>
                ` : ''}

                ${editingMessage ? html`
                    <div class="drawer-content">
                        
                        <sl-input 
                            label="${this.msg("Assignment (variable)")}"
                            value="${editingMessage.assignment || ''}" 
                            @sl-input=${(e: any) => this._handleMessageUpdate('assignment', e.target.value)}
                            @sl-blur=${(e: any) => { this._handleMessageUpdate('assignment', e.target.value.trim()); this._handleBlur(`msg-${editingMessage.id}-assignment`); }}
                            @sl-focus=${() => this._handleFocus(`msg-${editingMessage.id}-assignment`)}
                            class=${shouldShowError(`msg-${editingMessage.id}-assignment`) ? 'has-error' : ''}
                        ></sl-input>
                        ${shouldShowError(`msg-${editingMessage.id}-assignment`) ? html`
                            <div class="validation-error">
                                <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                ${shouldShowError(`msg-${editingMessage.id}-assignment`)?.message}
                            </div>
                        ` : ''}

                        <div style="display: flex; flex-direction: column;">
                            <sl-input 
                                label="${this.msg("Message Name")}"
                                value="${editingMessage.name || ''}" 
                                @sl-input=${(e: any) => this._handleMessageUpdate('name', e.target.value)}
                                @sl-blur=${(e: any) => { this._handleMessageUpdate('name', e.target.value.trim()); this._handleBlur(`msg-${editingMessage.id}-name`); }}
                                @sl-focus=${() => this._handleFocus(`msg-${editingMessage.id}-name`)}
                                class=${shouldShowError(`msg-${editingMessage.id}-name`) ? 'has-error' : ''}
                            ></sl-input>
                            ${shouldShowError(`msg-${editingMessage.id}-name`) ? html`
                                <div class="validation-error">
                                    <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                    ${shouldShowError(`msg-${editingMessage.id}-name`)?.message}
                                </div>
                            ` : ''}
                        </div>

                        ${!isStructuralMessage ? html`
                            <sl-select 
                                label="${this.msg("Message Type")}"
                                value="${editingMessage.type}"
                                @sl-change=${(e: any) => this._handleMessageUpdate('type', e.target.value)}
                            >
                                ${this.settings.synchronousMessageExists || editingMessage.type === 'sync' ? html`
                                    <sl-option value="sync">${this.msg("Synchronous")}</sl-option>
                                ` : ''}

                                ${this.settings.asynchronousMessageExists || editingMessage.type === 'async' ? html`
                                    <sl-option value="async">${this.msg("Asynchronous")}</sl-option>
                                ` : ''}

                                ${this.settings.replyMessageExists || editingMessage.type === 'reply' ? html`
                                    <sl-option value="reply">${this.msg("Reply (Return)")}</sl-option>
                                ` : ''}
                            </sl-select>
                        ` : html`
                            <sl-input label="${this.msg("Message Type")}" value=${editingMessage.type === 'create' ? this.msg("Create")
                                : editingMessage.type === 'destroy' ? this.msg("Destroy")
                                : editingMessage.type === 'found' ? this.msg("Found")
                                : this.msg("Lost")} disabled></sl-input>
                        `}

                        <sl-button variant="danger" outline @click=${this._handleDeleteMessageClick}>
                            <sl-icon slot="prefix" src=${trashIcon}></sl-icon>
                            ${this.msg("Delete Message")}
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
                            ${this.msg("Delete Activation")}
                        </sl-button>
                    </div>
                ` : ''}

               ${this.editingFragmentId ? (() => {
                    const frag = this.model.fragments?.find(f => f.id === this.editingFragmentId);
                    if (!frag) return '';

                    return html`
                        <div class="drawer-content">
                            
                            <sl-select 
                                label=${this.msg("Fragment Type")}
                                value="${frag.type}"
                                @sl-change=${(e: any) => this._handleFragmentUpdate('type', e.target.value)}
                            >
                                ${this.settings.optionalFragmentExists || frag.type === 'opt' ? html`
                                    <sl-option value="opt">${this.msg("Optional")} (opt)</sl-option>
                                ` : ''}
                                
                                ${this.settings.alternativeFragmentExists || frag.type === 'alt' ? html`
                                    <sl-option value="alt">${this.msg("Alternative")} (alt)</sl-option>
                                ` : ''}
                                
                                ${this.settings.loopFragmentExists || frag.type === 'loop' ? html`
                                    <sl-option value="loop">${this.msg("Loop")} (loop)</sl-option>
                                ` : ''}
                            </sl-select>

                            ${frag.operands.map((op, index) => html`
                                <div class="operand-row">
                                    <div class="operand-input-wrapper">
                                        <sl-input 
                                            label=${this.msg(str`Condition ${index + 1}`)}
                                            value="${op.guard}"
                                            @sl-change=${(e: any) => this._handleFragmentOperandUpdate(op.id, e.target.value)}
                                            @sl-blur=${() => this._handleBlur(`frag-${frag.id}-op-${op.id}-guard`)}
                                            @sl-focus=${() => this._handleFocus(`frag-${frag.id}-op-${op.id}-guard`)}
                                            class=${shouldShowError(`frag-${frag.id}-op-${op.id}-guard`) ? 'has-error' : ''}
                                        ></sl-input>
                                        ${shouldShowError(`frag-${frag.id}-op-${op.id}-guard`) ? html`
                                            <div class="validation-error">
                                                <sl-icon src=${alertTriangleIcon}></sl-icon> 
                                                ${shouldShowError(`frag-${frag.id}-op-${op.id}-guard`)?.message}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <sl-button
                                        variant="danger"
                                        outline
                                        ?disabled=${frag.operands.length <= 1}
                                        @click=${() => this._handleRemoveFragmentOperand(op.id)}
                                        title="${this.msg("Remove Region")}"
                                        aria-label=${this.msg("Remove Region")}
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
                                        ${this.msg("Add Region")}
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
                                ${this.msg("Delete Fragment")}
                            </sl-button>
                        </div>
                    `;
                })() : ''}
            </sl-drawer>

            <confirm-dialog></confirm-dialog>

        `;
    }
}
