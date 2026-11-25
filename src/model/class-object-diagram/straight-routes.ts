import { Box, Point, RelationEnds } from './route-geometry';

/** Clearance for arrowheads. */
const CORNER_MARGIN = 15;

/** Preferred spacing; reduced on crowded sides. */
const RELATION_GAP = 30;

/** Distance over which diagonal attachments move away from the nearest corner. */
const DIAGONAL_BLEND_DISTANCE = 40;

const LOOP_WIDTH = 40;

type Side = 'top' | 'bottom' | 'left' | 'right';

/** Position along a side: x for top/bottom, y for left/right. */
interface RelationEnd {
    relationId: string;
    boxId: string;
    otherBoxId: string;
    side: Side;
    /** Preferred attachment position. */
    aim: number;
    /** Tie-breaker for relations with the same aim. */
    otherAim: number;
    position?: number;
}

/** Routes between facing sides, with shared spacing and left-side self-loops. */
export function straightRoutes(boxes: Map<string, Box>, relations: Map<string, RelationEnds>): Map<string, Point[]> {
    const routes = new Map<string, Point[]>();
    const sides = new Map<string, RelationEnd[]>();
    const ends = new Map<string, [RelationEnd, RelationEnd]>();
    const sideKey = (end: RelationEnd) => `${end.boxId}-${end.side}`;
    relations.forEach(({ source, target }, id) => {
        if (!boxes.has(source) || !boxes.has(target)) return;
        const box = boxes.get(source)!;
        const loopEnd: RelationEnd = {
            relationId: id, boxId: source, otherBoxId: target, side: 'left',
            aim: box.y + box.height / 2, otherAim: box.y + box.height / 2
        };
        const relationEnds: [RelationEnd, RelationEnd] = source === target
            ? [loopEnd, { ...loopEnd }]
            : relationEndsBetween(id, source, box, target, boxes.get(target)!);
        ends.set(id, relationEnds);
        for (const end of relationEnds) {
            const key = sideKey(end);
            if (!sides.has(key)) sides.set(key, []);
            sides.get(key)!.push(end);
        }
    });

    // Connected sides share a gap so repeated relations stay parallel.
    const gaps = new Map<string, number>();
    sides.forEach((sideEnds, key) => {
        const box = boxes.get(sideEnds[0].boxId)!;
        const length = isHorizontalSide(sideEnds[0].side) ? box.width : box.height;
        gaps.set(key, sideEnds.length > 1
            ? Math.min(RELATION_GAP, Math.max(0, length - 2 * CORNER_MARGIN) / (sideEnds.length - 1))
            : RELATION_GAP);
    });
    const visited = new Set<string>();
    for (const key of sides.keys()) {
        if (visited.has(key)) continue;
        const component: string[] = [];
        const pending = [key];
        let gap = RELATION_GAP;
        while (pending.length) {
            const current = pending.pop()!;
            if (visited.has(current)) continue;
            visited.add(current);
            component.push(current);
            gap = Math.min(gap, gaps.get(current)!);
            for (const end of sides.get(current)!) {
                pending.push(...ends.get(end.relationId)!.map(sideKey));
            }
        }
        component.forEach(side => gaps.set(side, gap));
    }

    sides.forEach((sideEnds, key) => {
        const box = boxes.get(sideEnds[0].boxId)!;
        const [from, length] = isHorizontalSide(sideEnds[0].side) ? [box.x, box.width] : [box.y, box.height];
        // Keep each pair together, including both ends of a self-loop.
        sideEnds.sort((a, b) => a.aim - b.aim || a.otherAim - b.otherAim
            || a.otherBoxId.localeCompare(b.otherBoxId, undefined, { numeric: true })
            || a.relationId.localeCompare(b.relationId, undefined, { numeric: true }));
        const positions = spread(sideEnds.map(end => end.aim), from + CORNER_MARGIN, from + length - CORNER_MARGIN, gaps.get(key)!);
        sideEnds.forEach((end, i) => end.position = positions[i]);
    });

    ends.forEach(([source, target], id) => {
        const start = pointOnSide(boxes.get(source.boxId)!, source.side, source.position!);
        const end = pointOnSide(boxes.get(target.boxId)!, target.side, target.position!);
        routes.set(id, source.boxId === target.boxId
            ? [start, { x: start.x - LOOP_WIDTH, y: start.y }, { x: end.x - LOOP_WIDTH, y: end.y }, end]
            : [start, end]);
    });
    // Shorten loops if an adjacent diagonal would cross their outer side.
    ends.forEach(([source, target], id) => {
        if (source.boxId !== target.boxId) return;
        const loop = routes.get(id)!;
        let width = LOOP_WIDTH;
        for (const end of sides.get(sideKey(source))!) {
            if (end.boxId === end.otherBoxId) continue;
            const route = routes.get(end.relationId)!;
            const pair = ends.get(end.relationId)!;
            const [near, far] = pair[0] === end ? route : [route[1], route[0]];
            const boundary = near.y < loop[0].y ? loop[0].y : loop[3].y;
            const t = (boundary - near.y) / (far.y - near.y);
            if (t > 0 && t <= 1 && far.x < near.x) {
                const depth = (near.x - far.x) * t;
                width = Math.min(width, depth - Math.min(5, depth / 2));
            }
        }
        loop[1].x = loop[2].x = loop[0].x - width;
    });
    return routes;
}

/** Attachment sides and aims for a pair of boxes. */
function relationEndsBetween(relationId: string, sourceId: string, source: Box, targetId: string, target: Box): [RelationEnd, RelationEnd] {
    const xOverlap = overlap(source.x, source.width, target.x, target.width);
    const yOverlap = overlap(source.y, source.height, target.y, target.height);
    const sourceCenter = center(source);
    const targetCenter = center(target);

    // Prefer overlap; otherwise use the slope between centers.
    const dx = Math.abs(sourceCenter.x - targetCenter.x);
    const dy = Math.abs(sourceCenter.y - targetCenter.y);
    const vertical = (xOverlap > 0 && xOverlap > yOverlap)
        || (!(yOverlap > 0 && yOverlap > xOverlap) && dx * (source.height + target.height) <= dy * (source.width + target.width));

    const [sourceSide, targetSide]: Side[] = vertical
        ? (sourceCenter.y < targetCenter.y ? ['bottom', 'top'] : ['top', 'bottom'])
        : (sourceCenter.x < targetCenter.x ? ['right', 'left'] : ['left', 'right']);
    const sourceAim = aimOnSide(source, sourceSide, target);
    const targetAim = aimOnSide(target, targetSide, source);
    return [
        { relationId, boxId: sourceId, otherBoxId: targetId, side: sourceSide, aim: sourceAim, otherAim: targetAim },
        { relationId, boxId: targetId, otherBoxId: sourceId, side: targetSide, aim: targetAim, otherAim: sourceAim }
    ];
}

/** Aim at the shared range, or blend from the nearest corner toward the center line. */
function aimOnSide(box: Box, side: Side, other: Box): number {
    const horizontal = isHorizontalSide(side);
    const [from, length, otherFrom, otherLength] = horizontal
        ? [box.x, box.width, other.x, other.width]
        : [box.y, box.height, other.y, other.height];
    const sharedStart = Math.max(from, otherFrom);
    const sharedEnd = Math.min(from + length, otherFrom + otherLength);
    if (sharedStart <= sharedEnd) return (sharedStart + sharedEnd) / 2;

    const otherIsAfter = otherFrom >= from + length;
    const corner = otherIsAfter ? from + length : from;
    const distance = otherIsAfter ? otherFrom - (from + length) : from - (otherFrom + otherLength);

    // where the line between the centers crosses the side
    const boxCenter = center(box);
    const otherCenter = center(other);
    const sideLine = pointOnSide(box, side, 0);
    const [along, otherAlong, across, otherAcross, sideAcross] = horizontal
        ? [boxCenter.x, otherCenter.x, boxCenter.y, otherCenter.y, sideLine.y]
        : [boxCenter.y, otherCenter.y, boxCenter.x, otherCenter.x, sideLine.x];
    const crossing = otherAcross === across ? corner : along + (otherAlong - along) * (sideAcross - across) / (otherAcross - across);

    // Keep attachments continuous as the shared range disappears.
    const weight = distance / (distance + DIAGONAL_BLEND_DISTANCE);
    return corner + (crossing - corner) * weight;
}

/** Fit sorted aims within the side, merging groups that overlap. */
function spread(aims: number[], min: number, max: number, gap: number): number[] {
    if (max < min) min = max = (min + max) / 2;

    // Center each group on its average aim, within the side.
    const groupStart = (group: number[]) => {
        const halfWidth = (group.length - 1) * gap / 2;
        const middle = group.reduce((sum, aim) => sum + aim, 0) / group.length;
        return Math.max(min + halfWidth, Math.min(max - halfWidth, middle)) - halfWidth;
    };

    // merge neighboring groups as long as they overlap
    const groups = aims.map(aim => [aim]);
    for (let i = 1; i < groups.length;) {
        if (groupStart(groups[i - 1]) + groups[i - 1].length * gap > groupStart(groups[i]) + 1e-6) {
            groups.splice(i - 1, 2, [...groups[i - 1], ...groups[i]]);
            i = Math.max(1, i - 1);
        } else {
            i++;
        }
    }
    return groups.flatMap(group => group.map((_, i) => groupStart(group) + i * gap));
}

function isHorizontalSide(side: Side) {
    return side === 'top' || side === 'bottom';
}

/** The point on a side of a class at the given position along it */
function pointOnSide(box: Box, side: Side, position: number): Point {
    switch (side) {
        case 'top': return { x: position, y: box.y };
        case 'bottom': return { x: position, y: box.y + box.height };
        case 'left': return { x: box.x, y: position };
        case 'right': return { x: box.x + box.width, y: position };
    }
}

/** Length of the range two intervals share */
function overlap(from: number, length: number, otherFrom: number, otherLength: number): number {
    return Math.max(0, Math.min(from + length, otherFrom + otherLength) - Math.max(from, otherFrom));
}

function center(box: Box): Point {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
