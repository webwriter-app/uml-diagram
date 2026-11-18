import type { ClassAttribute, ClassMethod, ClassModel } from "../class-object-diagram/class-model";
import { ClassDiagram } from "../class-object-diagram/diagram";
import { SequenceModel } from "../sequence-diagram/sequence-model";
import type { Fragment, Lifeline, SequenceMessage } from "../sequence-diagram/sequence-model";
import { classBoxSize } from "./svg-export";

/** Translates a source string of the widget's catalog */
type Msg = (source: string) => string;

export type PlantUmlResult =
    | { kind: 'class' | 'object'; json: string }
    | { kind: 'sequence'; model: SequenceModel };

const NAME = String.raw`"[^"]+"|[\w.]+`;
const CLASS_DECLARATION = new RegExp(String.raw`^(abstract\s+class|abstract|class|interface|enum|annotation|object)\s+(${NAME})(<[^>]*>)?(?:\s+as\s+(\w+))?(?:\s*<<\s*(\w+)\s*>>)?\s*(\{)?$`, 'i');
const RELATION = new RegExp(String.raw`^(${NAME})\s*(?:"([^"]*)"\s*)?(<\|?|\*|o|<|#|\})?((?:-+|\.+)(?:\[[^\]]*\])?(?:(?:up|down|left|right|u|d|l|r)?(?:-+|\.+))?)(\|>|\*|o|>|#|\{)?\s*(?:"([^"]*)"\s*)?(${NAME})\s*(?::\s*(.*))?$`, 'i');
const ASSOCIATION_CLASS = new RegExp(String.raw`^\(\s*(${NAME})\s*,\s*(${NAME})\s*\)\s*\.\.\s*(${NAME})$`);
const MEMBER_LINE = new RegExp(String.raw`^(${NAME})\s*:\s*(.+)$`);
const SEQUENCE_DECLARATION = new RegExp(String.raw`^(participant|actor|boundary|control|entity|database|collections|queue)\s+(${NAME})(?:\s+as\s+(${NAME}))?(?:\s*<<\s*([^>]*?)\s*>>)?(?:\s+#\w+)?$`, 'i');
const MESSAGE = new RegExp(String.raw`^(\[)?\s*(${NAME})?\s*(<{0,2}-{1,2}>{0,2})(\])?\s*(${NAME})?\s*(?::\s*(.*))?$`);

const unquote = (text: string) => text.replace(/^"(.*)"$/, '$1').trim();
const SEQUENCE_KEYWORDS = ['title', 'autonumber', 'skinparam', 'hide', 'show', 'note', 'legend', 'header', 'footer', 'newpage', 'return', '...', '|||', '==', 'ref', 'box', 'end box', 'left', 'right', 'scale', 'caption', 'set'];

function visibilityOf(symbol: string | undefined): ClassAttribute['visibility'] {
    return ({ '-': 'private', '#': 'protected', '~': 'package' } as Record<string, ClassAttribute['visibility']>)[symbol ?? ''] ?? 'public';
}

function parseMember(text: string, isObject: boolean): { attribute?: ClassAttribute; method?: ClassMethod } {
    let rest = text.trim();
    let isStatic = false;
    rest = rest.replace(/\{(static|abstract)\}/gi, (_, modifier: string) => { if (modifier.toLowerCase() === 'static') isStatic = true; return ''; }).trim();
    const symbol = /^[-+#~]/.exec(rest)?.[0];
    if (symbol) rest = rest.slice(1).trim();
    const visibility = visibilityOf(symbol);
    const open = rest.indexOf('(');
    const close = rest.lastIndexOf(')');
    if (open > 0 && close > open) {
        const after = rest.slice(close + 1);
        const isFinal = /\{final\}/i.test(after);
        const parameters = rest.slice(open + 1, close).split(',').map(part => part.trim()).filter(Boolean).map(part => {
            const [name, ...type] = part.split(/\s*:\s*/);
            return { name: name.trim(), type: type.join(': ').trim() };
        });
        return { method: { visibility, name: rest.slice(0, open).trim(), returnType: after.replace(/\{final\}/gi, '').replace(/^\s*:\s*/, '').trim(), parameters, isStatic, isFinal } };
    }
    const isFinal = /\{readOnly\}/i.test(rest);
    rest = rest.replace(/\{readOnly\}/gi, '').trim();
    const separator = isObject ? /\s*=\s*/ : /\s*:\s*/;
    const parts = rest.split(separator);
    let name = parts[0].trim();
    let type = parts.slice(1).join(isObject ? ' = ' : ': ').trim();
    if (!isObject && parts.length === 1 && /\s/.test(name)) {
        const words = name.split(/\s+/);
        name = words.pop()!;
        type = words.join(' ');
    }
    return { attribute: { visibility, name, type, isStatic, isFinal, isParam: false } };
}

const emptyClass = (type: ClassModel['type'], name: string): ClassModel => ({
    type, name, attributes: [], methods: [], objectName: '', enumValues: [], associatedConnectionId: '',
});

function parseClassDiagram(lines: string[], kind: 'class' | 'object', msg: Msg): PlantUmlResult {
    const diagram = new ClassDiagram();
    const ids = new Map<string, string>();
    const nodes = new Map<string, ClassModel>();
    const pending: { id: string }[] = [];
    let current: { data: ClassModel; id: string } | undefined;
    const containers: boolean[] = [];

    const declare = (names: string[], data: ClassModel) => {
        const node = diagram.addClass(data, 0, 0);
        const id = String(node.id);
        for (const name of names) ids.set(name, id);
        nodes.set(id, data);
        pending.push({ id });
        return { data, id };
    };
    const find = (name: string) => {
        const key = unquote(name);
        const known = ids.get(key);
        if (known) return known;
        return declare([key], emptyClass(kind === 'object' ? 'object' : 'standard', key)).id;
    };

    for (const line of lines) {
        if (current) {
            if (line === '}') { current = undefined; continue; }
            if (current.data.type === 'enum') current.data.enumValues.push(line);
            else {
                const { attribute, method } = parseMember(line, current.data.type === 'object');
                if (attribute) current.data.attributes.push(attribute);
                if (method) current.data.methods.push(method);
            }
            continue;
        }
        if (line === '}') { containers.pop(); continue; }
        const declaration = CLASS_DECLARATION.exec(line);
        if (declaration) {
            const [, keyword, rawName, generics, alias, stereotype, brace] = declaration;
            const word = keyword.toLowerCase().replace(/\s+/g, ' ');
            let type: ClassModel['type'] = word === 'object' ? 'object' : word.startsWith('abstract') ? 'abstract' : word === 'interface' ? 'interface' : word === 'enum' ? 'enum' : word === 'annotation' ? 'annotation' : 'standard';
            if (type === 'standard' && (stereotype === 'datatype' || stereotype === 'record')) type = stereotype;
            const label = unquote(rawName);
            const data = emptyClass(type, label);
            if (type === 'object') {
                const [objectName, ...className] = label.split(/\s+:\s+/);
                data.objectName = objectName.trim();
                data.name = className.join(' : ').trim();
            }
            if (generics) {
                data.type = 'param-class';
                data.attributes = generics.slice(1, -1).split(',').map(part => part.trim()).filter(Boolean)
                    .map(name => ({ visibility: 'public', name, type: '', isStatic: false, isFinal: false, isParam: true }));
            }
            const entry = declare([label, ...(alias ? [alias] : [])], data);
            if (brace) current = entry;
            continue;
        }
        const association = ASSOCIATION_CLASS.exec(line);
        if (association) {
            const [, a, b, associationClass] = association;
            const from = find(a);
            const to = find(b);
            const relation = diagram.relations().find(candidate => (candidate.source === from && candidate.target === to) || (candidate.source === to && candidate.target === from)
                || (from === to && candidate.self && candidate.from === from));
            if (relation) nodes.get(find(associationClass))!.associatedConnectionId = relation.id;
            continue;
        }
        const relation = RELATION.exec(line);
        if (relation) {
            const [, left, leftMultiplicity = '', leftHead = '', body, rightHead = '', rightMultiplicity = '', right, name = ''] = relation;
            const dashed = body.includes('.');
            let swap = false;
            let type = dashed ? 'dependency' : 'association-undirected';
            if (rightHead === '|>' || leftHead === '<|') { swap = leftHead === '<|' && rightHead !== '|>'; type = dashed ? 'realization' : 'inheritance'; }
            else if (rightHead === '*' || rightHead === 'o') type = rightHead === '*' ? 'composition' : 'aggregation';
            else if (leftHead === '*' || leftHead === 'o') { swap = true; type = leftHead === '*' ? 'composition' : 'aggregation'; }
            else if (leftHead === '<' && rightHead === '>') type = 'association-bidirectional';
            else if (rightHead === '>') type = dashed ? 'dependency' : 'association';
            else if (leftHead === '<') { swap = true; type = dashed ? 'dependency' : 'association'; }
            const [source, target] = swap ? [right, left] : [left, right];
            const [sourceMultiplicity, targetMultiplicity] = swap ? [rightMultiplicity, leftMultiplicity] : [leftMultiplicity, rightMultiplicity];
            const id = diagram.addRelation(find(source), find(target), type);
            if (id) diagram.updateRelationData(id, { relationName: name.trim(), sourceMultiplicity, targetMultiplicity });
            continue;
        }
        const memberLine = MEMBER_LINE.exec(line);
        if (memberLine && ids.has(unquote(memberLine[1]))) {
            const data = nodes.get(ids.get(unquote(memberLine[1]))!)!;
            if (data.type === 'enum') data.enumValues.push(memberLine[2].trim());
            else {
                const { attribute, method } = parseMember(memberLine[2], data.type === 'object');
                if (attribute) data.attributes.push(attribute);
                if (method) data.methods.push(method);
            }
            continue;
        }
        if (/\{$/.test(line)) containers.push(true);
    }

    if (!diagram.classCount) throw new Error(msg("The file contains no diagram that this widget can read."));
    const sizes = pending.map(({ id }) => ({ id, ...classBoxSize(nodes.get(id)!) }));
    const columns = Math.max(1, Math.ceil(Math.sqrt(sizes.length)));
    let y = 40;
    for (let start = 0; start < sizes.length; start += columns) {
        const row = sizes.slice(start, start + columns);
        let x = 40;
        for (const size of row) {
            diagram.moveNode(size.id, x, y);
            x += size.width + 100;
        }
        y += Math.max(...row.map(size => size.height)) + 100;
    }
    return { kind, json: diagram.serialize() };
}

function parseSequence(lines: string[], msg: Msg): PlantUmlResult {
    const lifelines: Lifeline[] = [];
    const messages: SequenceMessage[] = [];
    const fragments: Fragment[] = [];
    const aliases = new Map<string, Lifeline>();
    const open: { fragment?: Fragment; start: number; marks: number[]; used: Set<string> }[] = [];
    const activations = new Map<string, { id: string; y: number }>();
    let cursor = 150;
    let created: string | undefined;

    const lifeline = (name: string, display = name, kind = 'participant', stereotype = '') => {
        const key = unquote(name);
        const known = aliases.get(key);
        if (known) return known;
        const label = unquote(display);
        const [objectName, ...className] = label.split(/\s+:\s+/);
        const entry: Lifeline = {
            id: `ll-${lifelines.length + 1}`,
            name: className.length ? objectName.trim() : label,
            className: className.join(' : ').trim(),
            stereotype,
            icon: kind === 'actor' ? 'user' : kind === 'database' ? 'database' : 'none',
            y: 40,
            length: 0,
            activations: [],
        };
        lifelines.push(entry);
        aliases.set(key, entry);
        aliases.set(label, entry);
        return entry;
    };
    const touch = (entry: Lifeline | undefined) => { if (entry) for (const frame of open) frame.used.add(entry.id); };

    for (const line of lines) {
        const declaration = SEQUENCE_DECLARATION.exec(line);
        if (declaration) {
            const [, kind, first, second, stereotype = ''] = declaration;
            const entry = second ? lifeline(second, first, kind.toLowerCase(), stereotype) : lifeline(first, first, kind.toLowerCase(), stereotype);
            if (second) aliases.set(unquote(first), entry);
            continue;
        }
        const command = /^(create|destroy|activate|deactivate)\s+(\S+)/i.exec(line);
        if (command) {
            const verb = command[1].toLowerCase();
            const entry = lifeline(command[2]);
            if (verb === 'create') created = entry.id;
            else if (verb === 'activate') activations.set(entry.id, { id: `act-${entry.id}-${entry.activations.length + 1}`, y: cursor - 10 });
            else if (verb === 'deactivate') {
                const start = activations.get(entry.id);
                if (start) { entry.activations.push({ id: start.id, y: start.y, length: Math.max(40, cursor - start.y) }); activations.delete(entry.id); }
            }
            continue;
        }
        const block = /^(alt|opt|loop|par|break|critical|group|else|end)\b\s*(.*)$/i.exec(line);
        if (block && !/^end\s+(box|note|ref)/i.test(line)) {
            const word = block[1].toLowerCase();
            const guard = block[2].trim();
            if (word === 'end') {
                const frame = open.pop();
                if (frame?.fragment) {
                    cursor += 20;
                    const bounds = [...frame.marks, cursor];
                    frame.fragment.operands.forEach((operand, index) => { operand.height = bounds[index + 1] - bounds[index]; });
                    const used = lifelines.filter(entry => frame.used.has(entry.id));
                    frame.fragment.startLifelineId = (used[0] ?? lifelines[0])?.id ?? '';
                    frame.fragment.endLifelineId = (used[used.length - 1] ?? lifelines[lifelines.length - 1])?.id ?? '';
                    for (const outer of open) for (const id of frame.used) outer.used.add(id);
                }
            } else if (word === 'else') {
                const frame = open[open.length - 1];
                if (frame?.fragment) {
                    cursor += 30;
                    frame.marks.push(cursor);
                    frame.fragment.operands.push({ id: `${frame.fragment.id}-op${frame.marks.length}`, guard: `[${guard || 'else'}]`, height: 0 });
                    cursor += 10;
                }
            } else if (word === 'alt' || word === 'opt' || word === 'loop') {
                const fragment: Fragment = { id: `frag-${fragments.length + 1}`, type: word, startLifelineId: '', endLifelineId: '', y: cursor, operands: [{ id: `frag-${fragments.length + 1}-op1`, guard: guard ? `[${guard}]` : '', height: 0 }] };
                fragments.push(fragment);
                open.push({ fragment, start: cursor, marks: [cursor], used: new Set() });
                cursor += 40;
            } else open.push({ start: cursor, marks: [], used: new Set() });
            continue;
        }
        if (SEQUENCE_KEYWORDS.some(keyword => line.toLowerCase().startsWith(keyword))) continue;
        const message = MESSAGE.exec(line);
        if (!message) continue;
        const [, found, from, arrow, lost, to, text = ''] = message;
        const reverse = arrow.startsWith('<');
        const dashed = arrow.includes('--');
        const async = arrow.endsWith('>>') || arrow.startsWith('<<');
        let type: SequenceMessage['type'] = dashed ? 'reply' : async ? 'async' : 'sync';
        const label = text.trim();
        const left = from ? lifeline(from) : undefined;
        const right = to ? lifeline(to) : undefined;
        if ((!left && !found) || (!right && !lost) || (!left && !right)) continue;
        const [source, target] = reverse ? [right, left] : [left, right];
        let sourceId = source?.id ?? 'external';
        let targetId = target?.id ?? 'external';
        if (found || (!source && !lost)) type = 'found';
        else if (lost || (!target && !found)) type = 'lost';
        if (type === 'found') sourceId = 'external';
        if (type === 'lost') targetId = 'external';
        let name = label;
        let assignment = '';
        const assigned = /^(\w+)\s*=\s*(.+)$/.exec(label);
        if (assigned) [, assignment, name] = assigned;
        if (created && target?.id === created) {
            type = 'create';
            target.y = cursor;
            created = undefined;
            name ||= '<<create>>';
        }
        touch(source);
        touch(target);
        messages.push({ id: `msg-${messages.length + 1}`, name, assignment, sourceId, targetId, y: cursor, type });
        cursor += type === 'create' ? 100 : source && source === target ? 70 : 50;
    }

    if (!messages.length && lifelines.length < 2) throw new Error(msg("The file contains no diagram that this widget can read."));
    for (const [id, start] of activations) {
        const entry = lifelines.find(candidate => candidate.id === id)!;
        entry.activations.push({ id: start.id, y: start.y, length: Math.max(40, cursor - start.y) });
    }
    for (const entry of lifelines) entry.length = Math.max(200, cursor + 60 - entry.y);
    const model = SequenceModel.getEmptyModel();
    model.lifelines = lifelines;
    model.messages = messages;
    model.fragments = fragments;
    return { kind: 'sequence', model };
}

/** Reads the PlantUML subset that class, object and sequence diagrams map to; other lines are skipped */
export function parsePlantUml(text: string, msg: Msg): PlantUmlResult {
    const all = text.replace(/^﻿/, '').split(/\r?\n/);
    const start = all.findIndex(line => /^\s*@startuml\b/i.test(line));
    if (start === -1) throw new Error(msg("The file is not a PlantUML diagram."));
    const end = all.findIndex((line, index) => index > start && /^\s*@enduml\b/i.test(line));
    const lines = all.slice(start + 1, end === -1 ? undefined : end).map(line => line.trim()).filter(line => line && !line.startsWith("'") && !line.startsWith('/'));
    const has = (pattern: RegExp) => lines.some(line => pattern.test(line));
    if (has(/^(abstract(\s+class)?|class|interface|enum|annotation)\s+\S/i)) return parseClassDiagram(lines, 'class', msg);
    if (has(/^object\s+\S/i)) return parseClassDiagram(lines, 'object', msg);
    return parseSequence(lines, msg);
}
