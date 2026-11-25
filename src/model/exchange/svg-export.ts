import type { ClassModel } from "../class-object-diagram/class-model";
import type { ClassDiagram, Relation } from "../class-object-diagram/diagram";
import { DASHED_TYPES, MARKERS } from "../class-object-diagram/relation-drawing";
import type { SequenceModel } from "../sequence-diagram/sequence-model";
import { ACTIVATION_WIDTH, HEAD_HEIGHT, HEAD_WIDTH, lifelineEnd, lifelineX } from "../sequence-diagram/sequence-rules";

const INK = '#1f2937';
const LINE_HEIGHT = 18;
const CHAR_WIDTH = 7.4;
const BOLD_CHAR_WIDTH = 8;
const MARGIN = 40;
const SYMBOLS: Record<string, string> = { public: '+', private: '-', package: '~', protected: '#' };
const STEREOTYPES = ['abstract', 'interface', 'enum', 'datatype', 'record', 'annotation'];

const escapeXml = (text: string) => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
const textWidth = (text: string) => text.length * CHAR_WIDTH;

/** The lines a class or object box shows, in its header, attribute and method sections */
export function classBoxLines(data: ClassModel) {
    const isObject = data.type === 'object';
    const visibility = (value: string) => isObject ? '' : `${SYMBOLS[value] ?? '#'} `;
    const separator = isObject ? ' = ' : ': ';
    const header = [
        ...(STEREOTYPES.includes(data.type) ? [`<<${data.type}>>`] : []),
        isObject ? `${data.objectName || ''}${data.name ? ` : ${data.name}` : ''}` : data.name,
    ];
    const attributes = data.type === 'enum'
        ? data.enumValues
        : (data.attributes ?? []).filter(attribute => data.type !== 'param-class' || !attribute.isParam)
            .map(attribute => `${visibility(attribute.visibility)}${attribute.name}${attribute.type ? separator + attribute.type : ''}`);
    const methods = data.type === 'enum' || data.type === 'annotation' || isObject ? [] : (data.methods ?? [])
        .map(method => `${visibility(method.visibility)}${method.name}(${(method.parameters ?? []).map(parameter => `${parameter.name}: ${parameter.type}`).join(', ')}): ${method.returnType}`);
    return { header, attributes, methods };
}

/** The size of the box of a class or object, estimated from its lines */
export function classBoxSize(data: ClassModel) {
    const { header, attributes, methods } = classBoxLines(data);
    const widest = Math.max(...[...header, ...attributes, ...methods].map(textWidth), 80);
    const sections = (lines: string[], always: boolean) => lines.length || always ? Math.max(lines.length, 1) * LINE_HEIGHT + 10 : 0;
    return {
        width: Math.round(widest + 24),
        height: header.length * LINE_HEIGHT + 14 + sections(attributes, true) + sections(methods, data.type !== 'enum' && data.type !== 'object' && data.type !== 'annotation'),
    };
}

const svgDocument = (width: number, height: number, body: string, title: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif" font-size="13" role="img" aria-label="${escapeXml(title)}">
<rect width="100%" height="100%" fill="#ffffff"/>
<defs>
<marker id="open" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 1 1 L 12 7 L 1 13" fill="none" stroke="${INK}" stroke-width="1.5"/></marker>
<marker id="filled" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 1 1 L 12 7 L 1 13 Z" fill="${INK}" stroke="${INK}" stroke-width="1.5"/></marker>
<marker id="triangle" markerWidth="16" markerHeight="16" refX="15" refY="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 1 1 L 15 8 L 1 15 Z" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/></marker>
<marker id="diamond" markerWidth="18" markerHeight="14" refX="17" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 1 7 L 9 1 L 17 7 L 9 13 Z" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/></marker>
<marker id="diamond-filled" markerWidth="18" markerHeight="14" refX="17" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 1 7 L 9 1 L 17 7 L 9 13 Z" fill="${INK}" stroke="${INK}" stroke-width="1.5"/></marker>
</defs>
<g fill="${INK}" stroke="none">
${body}
</g>
</svg>
`;

const MARKER_IDS: Record<string, string> = { 'open-arrow': 'open', triangle: 'triangle', diamond: 'diamond', 'diamond-filled': 'diamond-filled' };

const label = (text: string | undefined, x: number, y: number, anchor = 'middle') =>
    text ? `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="12">${escapeXml(text)}</text>` : '';

/** Where the line from the centre of a box towards a point leaves the box */
function borderPoint(box: { x: number; y: number; width: number; height: number }, towards: { x: number; y: number }) {
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const dx = towards.x - centre.x;
    const dy = towards.y - centre.y;
    if (!dx && !dy) return centre;
    const scale = Math.min(dx ? box.width / 2 / Math.abs(dx) : Infinity, dy ? box.height / 2 / Math.abs(dy) : Infinity);
    return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

/** The class or object diagram as a standalone SVG picture; `null` when it has no classes */
export function classDiagramToSvg(diagram: ClassDiagram, title: string): string | null {
    const classes = diagram.classes;
    if (!classes.length) return null;
    const minX = Math.min(...classes.map(node => node.pos_x));
    const minY = Math.min(...classes.map(node => node.pos_y));
    const boxes = new Map(classes.map(node => {
        const size = classBoxSize(node.data);
        return [String(node.id), { x: node.pos_x - minX + MARGIN, y: node.pos_y - minY + MARGIN, ...size }];
    }));

    let right = 0;
    let bottom = 0;
    let body = '';
    for (const box of boxes.values()) {
        right = Math.max(right, box.x + box.width);
        bottom = Math.max(bottom, box.y + box.height);
    }

    const drawRelation = (relation: Relation) => {
        const from = boxes.get(relation.from);
        const to = boxes.get(relation.to);
        if (!from || !to) return '';
        const type = diagram.typeOf(relation) ?? '';
        const markers = MARKERS[type] ?? {};
        const attributes = `fill="none" stroke="${INK}" stroke-width="1.5"${DASHED_TYPES.includes(type) ? ' stroke-dasharray="7 5"' : ''}`
            + `${markers.start ? ` marker-start="url(#${MARKER_IDS[markers.start]})"` : ''}${markers.end ? ` marker-end="url(#${MARKER_IDS[markers.end]})"` : ''}`;
        const { relationName, sourceMultiplicity, targetMultiplicity, sourceRole, targetRole } = relation.data;
        if (relation.self) {
            const x = from.x + from.width;
            const y = from.y + 20;
            right = Math.max(right, x + 60);
            return `<path d="M ${x} ${y} L ${x + 40} ${y} L ${x + 40} ${y + 40} L ${x} ${y + 40}" ${attributes}/>`
                + label(relationName, x + 44, y + 24, 'start') + label(sourceMultiplicity, x + 4, y - 4, 'start') + label(targetMultiplicity, x + 4, y + 56, 'start');
        }
        const centreTo = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
        const centreFrom = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
        const start = borderPoint(from, centreTo);
        const end = borderPoint(to, centreFrom);
        const near = (point: { x: number; y: number }, other: { x: number; y: number }, offset: number, lift: number) => {
            const length = Math.hypot(other.x - point.x, other.y - point.y) || 1;
            return { x: point.x + (other.x - point.x) / length * offset - (other.y - point.y) / length * lift, y: point.y + (other.y - point.y) / length * offset + (other.x - point.x) / length * lift };
        };
        const place = (text: string | undefined, point: { x: number; y: number }, other: { x: number; y: number }, lift: number) => {
            const at = near(point, other, 24, lift);
            return label(text, at.x, at.y);
        };
        return `<path d="M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}" ${attributes}/>`
            + label(relationName, (start.x + end.x) / 2, (start.y + end.y) / 2 - 6)
            + place(sourceMultiplicity, start, end, -10) + place(sourceRole, start, end, 14)
            + place(targetMultiplicity, end, start, 10) + place(targetRole, end, start, -14);
    };

    const lines = diagram.relations().map(drawRelation).join('\n');
    for (const node of classes) {
        const box = boxes.get(String(node.id))!;
        const { header, attributes, methods } = classBoxLines(node.data);
        const isObject = node.data.type === 'object';
        const centre = box.x + box.width / 2;
        let y = box.y;
        const section = (entries: string[], fallback: boolean, anchor: 'middle' | 'start', extra = '') => {
            if (!entries.length && !fallback) return '';
            const height = Math.max(entries.length, 1) * LINE_HEIGHT + 10;
            const text = entries.map((entry, index) => `<text x="${anchor === 'middle' ? centre : box.x + 8}" y="${y + 5 + (index + 1) * LINE_HEIGHT - 4}" text-anchor="${anchor}"${extra}>${escapeXml(entry)}</text>`).join('');
            const separator = y > box.y ? `<line x1="${box.x}" y1="${y}" x2="${box.x + box.width}" y2="${y}" stroke="${INK}"/>` : '';
            y += height;
            return separator + text;
        };
        const headerHeight = header.length * LINE_HEIGHT + 14;
        body += `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/>`
            + header.map((line, index) => `<text x="${centre}" y="${box.y + 7 + (index + 1) * LINE_HEIGHT - 4}" text-anchor="middle"${index === header.length - 1 ? ` font-weight="bold"${isObject ? ' text-decoration="underline"' : ''}${node.data.type === 'abstract' ? ' font-style="italic"' : ''}` : ''}>${escapeXml(line)}</text>`).join('');
        y += headerHeight;
        body += section(attributes, true, 'start') + section(methods, node.data.type !== 'enum' && !isObject && node.data.type !== 'annotation', 'start') + '</g>\n';
    }
    return svgDocument(Math.ceil(right + MARGIN), Math.ceil(bottom + MARGIN), lines + '\n' + body, title);
}

/** The sequence diagram as a standalone SVG picture; `null` when it has no lifelines */
export function sequenceToSvg(model: SequenceModel, title: string): string | null {
    if (!model.lifelines.length) return null;
    const x = (id: string) => lifelineX(model, id);
    let bottom = 0;
    let body = '';

    for (const fragment of model.fragments ?? []) {
        const left = Math.min(x(fragment.startLifelineId), x(fragment.endLifelineId)) - HEAD_WIDTH / 2;
        const width = Math.abs(x(fragment.endLifelineId) - x(fragment.startLifelineId)) + HEAD_WIDTH;
        let y = fragment.y;
        const total = fragment.operands.reduce((sum, operand) => sum + operand.height, 0);
        body += `<rect x="${left}" y="${y}" width="${width}" height="${total}" fill="none" stroke="${INK}"/>`
            + `<path d="M ${left} ${y} h 50 v 14 l -8 8 h -42 Z" fill="#ffffff" stroke="${INK}"/><text x="${left + 6}" y="${y + 15}" font-size="12" font-weight="bold">${escapeXml(fragment.type)}</text>`;
        fragment.operands.forEach((operand, index) => {
            if (index) body += `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="${INK}" stroke-dasharray="6 4"/>`;
            body += label(operand.guard, left + 60, y + 16, 'start');
            y += operand.height;
        });
        bottom = Math.max(bottom, y);
    }

    for (const lifeline of model.lifelines) {
        const centre = x(lifeline.id);
        const end = lifelineEnd(model, lifeline);
        bottom = Math.max(bottom, end);
        const name = `${lifeline.name}${lifeline.className ? ` : ${lifeline.className}` : ''}`;
        // A name that is wider than the head is squeezed into it
        const room = HEAD_WIDTH - 12;
        const squeeze = name.length * BOLD_CHAR_WIDTH > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : '';
        body += `<line x1="${centre}" y1="${lifeline.y + HEAD_HEIGHT}" x2="${centre}" y2="${end}" stroke="${INK}" stroke-dasharray="6 4"/>`
            + `<rect x="${centre - HEAD_WIDTH / 2}" y="${lifeline.y}" width="${HEAD_WIDTH}" height="${HEAD_HEIGHT}" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/>`
            + (lifeline.stereotype ? label(`<<${lifeline.stereotype}>>`, centre, lifeline.y + 30) : '')
            + `<text x="${centre}" y="${lifeline.y + 50}" text-anchor="middle" font-weight="bold" text-decoration="underline"${squeeze}>${escapeXml(name)}</text>`;
        for (const activation of lifeline.activations ?? []) {
            body += `<rect x="${centre - ACTIVATION_WIDTH / 2}" y="${activation.y}" width="${ACTIVATION_WIDTH}" height="${activation.length}" fill="#ffffff" stroke="${INK}"/>`;
        }
    }

    for (const message of model.messages) {
        const found = message.type === 'found';
        const lost = message.type === 'lost';
        const source = model.lifelines.find(lifeline => lifeline.id === message.sourceId);
        const target = model.lifelines.find(lifeline => lifeline.id === message.targetId);
        if ((!source && !found) || (!target && !lost)) continue;
        const text = `${message.assignment ? `${message.assignment} = ` : ''}${message.name}`;
        const dashed = message.type === 'reply' || message.type === 'create';
        const marker = ['sync', 'destroy', 'found', 'lost'].includes(message.type) ? 'filled' : 'open';
        const stroke = `fill="none" stroke="${INK}" stroke-width="1.5"${dashed ? ' stroke-dasharray="7 5"' : ''}`;
        const y = message.type === 'create' ? message.y + HEAD_HEIGHT / 2 : message.y;
        if (message.sourceId === message.targetId && source) {
            const sx = x(source.id) + ACTIVATION_WIDTH / 2;
            body += `<path d="M ${sx} ${y} h 40 v 30 h -40" ${stroke} marker-end="url(#${marker})"/>` + label(text, sx + 46, y + 18, 'start');
            bottom = Math.max(bottom, y + 30);
            continue;
        }
        const startX = found ? x(target!.id) - 150 : x(source!.id);
        const endX = lost ? x(source!.id) + 150 : x(target!.id);
        const direction = endX >= startX ? 1 : -1;
        const from = startX + (found ? 0 : direction * ACTIVATION_WIDTH / 2);
        const to = endX - (lost ? 0 : direction * (message.type === 'create' ? HEAD_WIDTH / 2 : ACTIVATION_WIDTH / 2));
        body += `<path d="M ${from} ${y} L ${to} ${y}" ${stroke} marker-end="url(#${marker})"/>` + label(text, (from + to) / 2, y - 6);
        bottom = Math.max(bottom, y);
    }

    const right = Math.max(...model.lifelines.map(lifeline => x(lifeline.id))) + HEAD_WIDTH / 2 + MARGIN + 150;
    return svgDocument(right, Math.ceil(bottom + MARGIN), body, title);
}

