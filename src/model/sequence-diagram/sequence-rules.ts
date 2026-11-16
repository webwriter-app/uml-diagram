import type { Fragment, Lifeline, SequenceModel } from "./sequence-model";
import type { SequenceSettings } from "./sequence-settings-model";

/** Translates a source string of the widget's catalog */
type Msg = (source: string) => string;

/** First slot position and slot width of the lifelines */
export const START_X = 100;
export const SLOT_SPACING = 250;

/** Size of the box with the name of a lifeline */
export const HEAD_WIDTH = 140;
export const HEAD_HEIGHT = 80;

/** Width of an activation bar and how far each nested bar is shifted to the right */
export const ACTIVATION_WIDTH = 14;
export const ACTIVATION_NESTING_OFFSET = 8;
export const MIN_ACTIVATION_LENGTH = 15;

/** Leave space below object headers and above lifeline ends. */
export const LIFELINE_PADDING = 20;
export const MIN_LIFELINE_LENGTH = 80 + 2 * LIFELINE_PADDING;

/** Fragment puffer height for collision with the end of a lifeline */
export const FRAGMENT_MIN_OVERLAP = 30;

/** The smallest height of one region of a fragment */
export const MIN_OPERAND_HEIGHT = 30;

/** The messages and fragments a rule checks, as the model or as it is shown during a gesture */
export type Diagram = Pick<SequenceModel, 'lifelines' | 'messages' | 'fragments'>;

/** One rule of the diagram that is broken, with the id of the field it is shown at and the setting that switches the rule on */
export interface SequenceValidationIssue {
    target: string;
    message: string;
    settingKey: keyof SequenceSettings;
}

/** The x coordinate of the lifeline with a given id (`order` is the order of the ids when it differs from the model) */
export function lifelineX(model: Pick<SequenceModel, 'lifelines'>, id: string, order?: string[]): number {
    const index = order ? order.indexOf(id) : model.lifelines.findIndex(ll => ll.id === id);
    return index === -1 ? 0 : START_X + index * SLOT_SPACING;
}

/** The y coordinate where the line of a lifeline ends: at its destroy message, if it has one */
export function lifelineEnd(model: Diagram, ll: Lifeline): number {
    const destroy = model.messages.find(m => m.type === 'destroy' && m.targetId === ll.id);
    if (!destroy) return ll.y + ll.length;
    return destroy.sourceId === destroy.targetId ? destroy.y + 30 : destroy.y;
}

/** The y-borders where messages are allowed to be moved or initially placed */
export function messageBounds(model: Diagram, sourceId: string, targetId: string, type: string, ignoreMsgId: string | null = null): { minY: number, maxY: number } {
    const sourceLL = model.lifelines.find(l => l.id === sourceId);
    const targetLL = model.lifelines.find(l => l.id === targetId);

    let minSourceY = 0;
    let maxSourceY = Infinity;
    let minTargetY = 0;
    let maxTargetY = Infinity;

    if (sourceLL) {
        minSourceY = sourceLL.y + 80 + LIFELINE_PADDING;

        const sourceDestroy = model.messages.find(m => m.type === 'destroy' && m.targetId === sourceLL.id && m.id !== ignoreMsgId);
        maxSourceY = (sourceDestroy?.y ?? sourceLL.y + sourceLL.length) - LIFELINE_PADDING;
    }

    if (targetLL) {
        minTargetY = targetLL.y + 80 + LIFELINE_PADDING;

        const targetDestroy = model.messages.find(m => m.type === 'destroy' && m.targetId === targetLL.id && m.id !== ignoreMsgId);
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
            const targetMsgs = model.messages.filter(m => (m.sourceId === targetId || m.targetId === targetId) && m.id !== ignoreMsgId && m.type !== 'create');
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
            const targetMsgs = model.messages.filter(m => (m.sourceId === targetId || m.targetId === targetId) && m.id !== ignoreMsgId && m.type !== 'destroy');
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

/** Padded bounds for activations and fragments of a lifeline */
export function lifelineBounds(model: Diagram, llId: string): { minY: number, maxY: number } {
    const ll = model.lifelines.find(l => l.id === llId);
    if (!ll) return { minY: 0, maxY: Infinity };

    const minY = ll.y + 80 + LIFELINE_PADDING;
    const destroyMsg = model.messages.find(m => m.type === 'destroy' && m.targetId === llId);
    const maxY = destroyMsg
        ? destroyMsg.y + (destroyMsg.sourceId === destroyMsg.targetId ? 30 : 0)
        : ll.y + ll.length;

    return { minY, maxY: maxY - LIFELINE_PADDING };
}

/** How short a lifeline can be made: messages, activations and the fragments that start at it have to stay on it */
export function minLifelineLength(model: Diagram, ll: Lifeline): number {
    const connectedMessages = model.messages.filter(m => m.sourceId === ll.id || m.targetId === ll.id);
    let fromMessages = 0;
    if (connectedMessages.length > 0) {
        const maxMessageY = Math.max(...connectedMessages.map(m =>
            m.y + (m.type === 'create' ? 40 : m.sourceId === m.targetId ? 30 : 0)));
        fromMessages = maxMessageY - ll.y + LIFELINE_PADDING;
    }

    let fromActivations = 0;
    if (ll.activations && ll.activations.length > 0) {
        const maxActBottom = Math.max(...ll.activations.map(act => act.y + act.length));
        fromActivations = maxActBottom - ll.y + LIFELINE_PADDING;
    }

    let fromFragments = 0;
    const started = (model.fragments || []).filter(f => f.startLifelineId === ll.id);
    if (started.length > 0) {
        fromFragments = Math.max(...started.map(f => f.y)) + FRAGMENT_MIN_OVERLAP - ll.y + LIFELINE_PADDING;
    }

    return Math.max(MIN_LIFELINE_LENGTH, fromMessages, fromActivations, fromFragments);
}

/** The activation bars of a lifeline from top to bottom, each shifted right for every bar it starts inside of */
export function activationBars(ll: Lifeline, x: number) {
    const activations = [...(ll.activations || [])].sort((a, b) => a.y - b.y);
    return activations.map((activation, index) => {
        const nestingLevel = activations.slice(0, index)
            .filter(outer => activation.y >= outer.y && activation.y < outer.y + outer.length).length;
        return { activation, nested: nestingLevel > 0, x: x - ACTIVATION_WIDTH / 2 + nestingLevel * ACTIVATION_NESTING_OFFSET };
    });
}

/** The height of a fragment: its regions together */
export const fragmentHeight = (frag: Fragment) => frag.operands.reduce((sum, op) => sum + op.height, 0);

/** The fragment ids that overlap with other fragments (nesting is allowed) */
export function overlappingFragmentIds(model: Diagram): Set<string> {
    const overlapping = new Set<string>();
    const fragments = model.fragments || [];

    // the y-range of the operands of a fragment
    const operandRanges = (frag: Fragment): { top: number, bottom: number }[] => {
        let currentY = frag.y;
        return frag.operands.map(op => {
            const range = { top: currentY, bottom: currentY + op.height };
            currentY += op.height;
            return range;
        });
    };

    // whether one fragment is fully inside of one operand of another fragment
    const fitsInOneOperand = (inner: Fragment, outer: Fragment): boolean => {
        const top = inner.y;
        const bottom = inner.y + fragmentHeight(inner);
        return operandRanges(outer).some(r => top >= r.top && bottom <= r.bottom);
    };

    const span = (frag: Fragment) => {
        const start = model.lifelines.findIndex(ll => ll.id === frag.startLifelineId);
        const end = model.lifelines.findIndex(ll => ll.id === frag.endLifelineId);
        return { min: Math.min(start, end), max: Math.max(start, end) };
    };

    fragments.forEach((fragA, i) => {
        const aTop = fragA.y;
        const aBottom = fragA.y + fragmentHeight(fragA);
        const a = span(fragA);

        fragments.forEach((fragB, j) => {
            if (i >= j) return;

            const bTop = fragB.y;
            const bBottom = fragB.y + fragmentHeight(fragB);
            const b = span(fragB);

            // no horizontal overlap
            if (!(a.min <= b.max && b.min <= a.max)) return;

            const mark = () => { overlapping.add(fragA.id); overlapping.add(fragB.id); };

            if (aTop <= bTop && aBottom >= bBottom) {
                // nesting is only valid if the fragment is horizontal and vertically fully inside an operand of the other fragment
                if (!(b.min >= a.min && b.max <= a.max) || !fitsInOneOperand(fragB, fragA)) mark();
                return;
            }

            if (bTop <= aTop && bBottom >= aBottom) {
                if (!(a.min >= b.min && a.max <= b.max) || !fitsInOneOperand(fragA, fragB)) mark();
                return;
            }

            if (aTop < bBottom && bTop < aBottom) mark();
        });
    });

    return overlapping;
}

/** All rules the diagram breaks, whether the settings switch them on or not */
export function sequenceIssues(model: Diagram, msg: Msg): SequenceValidationIssue[] {
    const issues: SequenceValidationIssue[] = [];

    model.lifelines.forEach(ll => {
        // object or class name required
        if (!ll.name || ll.name.trim() === '') {
            issues.push({ target: `ll-${ll.id}-name`, message: msg("Object name is required."), settingKey: 'checkForEmptyObjectNames' });
        }
        if (!ll.className || ll.className.trim() === '') {
            issues.push({ target: `ll-${ll.id}-classname`, message: msg("Class name is required."), settingKey: 'checkForEmptyClassNames' });
        }

        // object name should start with lower case letter
        if (ll.name && /^[A-ZÄÖÜ]/.test(ll.name.trim())) {
            issues.push({ target: `ll-${ll.id}-name`, message: msg("Object names should start with a lowercase letter (e.g. myObject)."), settingKey: 'checkForFirstLetterOfObject' });
        }

        // object name shouldn't contain space
        if (ll.name && /\s/.test(ll.name.trim())) {
            issues.push({ target: `ll-${ll.id}-name`, message: msg('Object names must not contain spaces.'), settingKey: 'checkForFirstLetterOfObject' });
        }

        // class name should start with upper case letter
        if (ll.className && /^[a-zäöü]/.test(ll.className.trim())) {
            issues.push({ target: `ll-${ll.id}-classname`, message: msg("Class names should start with an uppercase letter (e.g. Customer)."), settingKey: 'checkForFirstLetterOfClass' });
        }

        // class name shouldn't contain space
        if (ll.className && /\s/.test(ll.className.trim())) {
            issues.push({ target: `ll-${ll.id}-classname`, message: msg('Class names must not contain spaces.'), settingKey: 'checkForFirstLetterOfClass' });
        }
    });

    model.messages.forEach(m => {
        // messages are normally methods and should start with a lower case letter (except replies)
        if (m.name && m.type !== 'reply' && !m.name.trim().startsWith('<') && /^[A-ZÄÖÜ]/.test(m.name.trim())) {
            issues.push({ target: `msg-${m.id}-name`, message: msg("Message names, except replies, should start with a lowercase letter."), settingKey: 'checkForFirstLetterOfMessages' });
        }

        // assignment should not contain spaces
        if (m.assignment && /\s/.test(m.assignment.trim())) {
            issues.push({ target: `msg-${m.id}-assignment`, message: msg('Assignment must not contain spaces.'), settingKey: 'checkForFirstLetterOfMessages' });
        }
    });

    (model.fragments || []).forEach(frag => {
        frag.operands.forEach(op => {
            // condition should not be empty or contain only the placeholder
            const guardText = op.guard ? op.guard.trim() : '';
            if (guardText === '' || guardText === '[condition]' || guardText === '[]') {
                issues.push({ target: `frag-${frag.id}-op-${op.id}-guard`, message: msg("Guard condition must not be empty."), settingKey: 'checkForEmptyGuards' });
            }
        });
    });

    return issues;
}
