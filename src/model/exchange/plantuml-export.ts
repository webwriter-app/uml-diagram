import type { ClassModel } from "../class-object-diagram/class-model";
import type { ClassDiagram, StoredNode } from "../class-object-diagram/diagram";
import type { SequenceModel } from "../sequence-diagram/sequence-model";

const VISIBILITY: Record<string, string> = { public: '+', private: '-', protected: '#', package: '~' };
const IDENTIFIER = /^[A-Za-z_][\w.]*$/;
const ARROWS: Record<string, string> = {
    'association': '-->',
    'association-bidirectional': '<-->',
    'association-undirected': '--',
    'inheritance': '--|>',
    'realization': '..|>',
    'dependency': '..>',
    'composition': '--*',
    'aggregation': '--o',
};

const oneLine = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const quote = (text: string) => `"${oneLine(text).replace(/"/g, "'")}"`;

function member(data: ClassModel, entry: ClassModel['attributes'][number] | ClassModel['methods'][number]): string {
    const modifiers = entry.isStatic ? '{static} ' : '';
    if ('returnType' in entry) {
        const parameters = (entry.parameters ?? []).map(parameter => parameter.type ? `${parameter.name} : ${parameter.type}` : parameter.name).join(', ');
        return `${modifiers}${VISIBILITY[entry.visibility] ?? '+'}${oneLine(entry.name)}(${oneLine(parameters)})${entry.returnType ? ` : ${oneLine(entry.returnType)}` : ''}${entry.isFinal ? ' {final}' : ''}`;
    }
    if (data.type === 'object') return `${oneLine(entry.name)}${entry.type ? ` = ${oneLine(entry.type)}` : ''}`;
    return `${modifiers}${VISIBILITY[entry.visibility] ?? '+'}${oneLine(entry.name)}${entry.type ? ` : ${oneLine(entry.type)}` : ''}${entry.isFinal ? ' {readOnly}' : ''}`;
}

function declaration(node: StoredNode, token: string, quoted: boolean): string[] {
    const data = node.data;
    const params = data.type === 'param-class' ? (data.attributes ?? []).filter(attribute => attribute.isParam).map(attribute => attribute.name) : [];
    const shown = data.type === 'object' ? `${data.objectName || ''}${data.name ? ` : ${data.name}` : ''}` : oneLine(data.name);
    const name = (quoted ? `${quote(shown)} as ${token}` : token) + (params.length ? `<${params.join(', ')}>` : '');
    const keyword = ({ abstract: 'abstract class', interface: 'interface', enum: 'enum', annotation: 'annotation', object: 'object' } as Record<string, string>)[data.type] ?? 'class';
    const stereotype = data.type === 'datatype' || data.type === 'record' ? ` <<${data.type}>>` : '';
    const body = data.type === 'enum'
        ? (data.enumValues ?? []).map(oneLine)
        : (data.attributes ?? []).filter(attribute => !attribute.isParam).map(attribute => member(data, attribute))
            .concat(data.type === 'object' ? [] : (data.methods ?? []).map(method => member(data, method)));
    return body.length ? [`${keyword} ${name}${stereotype} {`, ...body.map(line => `  ${line}`), '}'] : [`${keyword} ${name}${stereotype}`];
}

/** PlantUML text of a class or object diagram; `null` when it has no classes */
export function classDiagramToPlantUml(diagram: ClassDiagram): string | null {
    const classes = diagram.classes;
    if (!classes.length) return null;
    const tokens = new Map<string, { token: string; quoted: boolean }>();
    const taken = new Map<string, number>();
    for (const node of classes) taken.set(node.data.name, (taken.get(node.data.name) ?? 0) + 1);
    for (const node of classes) {
        const plain = node.data.type !== 'object' && IDENTIFIER.test(node.data.name ?? '') && taken.get(node.data.name) === 1;
        tokens.set(String(node.id), plain ? { token: node.data.name, quoted: false } : { token: `${node.data.type === 'object' ? 'O' : 'C'}${node.id}`, quoted: true });
    }
    const lines = ['@startuml', ...classes.flatMap(node => declaration(node, tokens.get(String(node.id))!.token, tokens.get(String(node.id))!.quoted))];
    const relations = diagram.relations();
    for (const relation of relations) {
        const { relationName, sourceMultiplicity, targetMultiplicity } = relation.data;
        const arrow = ARROWS[diagram.typeOf(relation) ?? ''] ?? '--';
        lines.push(`${tokens.get(relation.from)!.token}${sourceMultiplicity ? ` ${quote(sourceMultiplicity)}` : ''} ${arrow}${targetMultiplicity ? ` ${quote(targetMultiplicity)}` : ''} ${tokens.get(relation.to)!.token}${relationName ? ` : ${oneLine(relationName)}` : ''}`);
    }
    for (const node of classes) {
        const relation = node.data.associatedConnectionId ? relations.find(candidate => candidate.id === node.data.associatedConnectionId) : undefined;
        if (relation) lines.push(`(${tokens.get(relation.from)!.token}, ${tokens.get(relation.to)!.token}) .. ${tokens.get(String(node.id))!.token}`);
    }
    return [...lines, '@enduml', ''].join('\n');
}

const guardText = (guard: string) => oneLine(guard).replace(/^\[(.*)\]$/, '$1');

/** PlantUML text of a sequence diagram; `null` when it has no lifelines */
export function sequenceToPlantUml(model: SequenceModel): string | null {
    if (!model.lifelines.length) return null;
    const alias = new Map(model.lifelines.map((lifeline, index) => [lifeline.id, `L${index + 1}`]));
    const lines = ['@startuml'];
    for (const lifeline of model.lifelines) {
        const display = `${oneLine(lifeline.name)}${lifeline.className ? ` : ${oneLine(lifeline.className)}` : ''}`;
        const kind = lifeline.icon === 'user' ? 'actor' : lifeline.icon === 'database' ? 'database' : 'participant';
        lines.push(`${kind} ${quote(display)} as ${alias.get(lifeline.id)}${lifeline.stereotype ? ` <<${oneLine(lifeline.stereotype)}>>` : ''}`);
    }

    // Everything that happens at a height of the diagram, in the order PlantUML needs it
    const events: { y: number; order: number; text: string }[] = [];
    const add = (y: number, order: number, text: string) => events.push({ y, order, text });
    for (const fragment of model.fragments ?? []) {
        let y = fragment.y;
        fragment.operands.forEach((operand, index) => {
            const guard = guardText(operand.guard);
            add(y, index ? 1 : 2, index ? `else${guard && guard !== 'else' ? ` ${guard}` : ''}` : `${fragment.type}${guard ? ` ${guard}` : ''}`);
            y += operand.height;
        });
        add(y, 0, 'end');
    }
    for (const lifeline of model.lifelines) {
        for (const activation of lifeline.activations ?? []) {
            add(activation.y, 4, `activate ${alias.get(lifeline.id)}`);
            add(activation.y + activation.length, 5, `deactivate ${alias.get(lifeline.id)}`);
        }
    }
    for (const message of model.messages) {
        const source = alias.get(message.sourceId);
        const target = alias.get(message.targetId);
        const text = `${message.assignment ? `${message.assignment} = ` : ''}${message.name}`;
        const label = text ? ` : ${oneLine(text)}` : '';
        if (message.type === 'found' && target) add(message.y, 3, `[-> ${target}${label}`);
        else if (message.type === 'lost' && source) add(message.y, 3, `${source} ->]${label}`);
        else if (source && target) {
            const arrow = message.type === 'async' ? '->>' : message.type === 'reply' ? '-->' : '->';
            if (message.type === 'create') add(message.y, 2.5, `create ${target}`);
            add(message.y, 3, `${source} ${arrow} ${target}${label}`);
            if (message.type === 'destroy') add(message.y, 3.5, `destroy ${target}`);
        }
    }
    events.sort((a, b) => a.y - b.y || a.order - b.order);
    return [...lines, ...events.map(event => event.text), '@enduml', ''].join('\n');
}
