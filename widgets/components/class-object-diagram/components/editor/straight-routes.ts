import { Box, Point, RelationEnds, selfRelationLoops } from './route-geometry';

/** Minimum distance of the outermost relation on a side to the corners of the class */
const CORNER_MARGIN = 10;

/**
 * Straight lines between the sides of two classes facing each other, ignoring anything in between.
 * Self-relations loop out of the left side of their class.
 */
export function straightRoutes(boxes: Map<string, Box>, relations: Map<string, RelationEnds>): Map<string, Point[]> {
    const routes = selfRelationLoops(boxes, relations);

    // relations between the same two classes (in either direction) are spread along the sides, in a stable order
    const pairs = new Map<string, string[]>();
    relations.forEach(({ source, target }, id) => {
        if (source === target || !boxes.has(source) || !boxes.has(target)) return;
        const pair = [source, target].sort().join('-');
        pairs.set(pair, [...(pairs.get(pair) ?? []), id]);
    });
    pairs.forEach(ids => {
        ids.sort();
        ids.forEach((id, index) => {
            const { source, target } = relations.get(id)!;
            routes.set(id, straightRoute(boxes.get(source)!, boxes.get(target)!, index, ids.length));
        });
    });
    return routes;
}

/** The index-th of count straight relations between two classes */
function straightRoute(source: Box, target: Box, index: number, count: number): Point[] {
    const xOverlap = overlap(source.x, source.width, target.x, target.width);
    const yOverlap = overlap(source.y, source.height, target.y, target.height);
    const sourceCenter = center(source);
    const targetCenter = center(target);

    // connect the top and bottom sides if the classes overlap more horizontally than vertically,
    // or (without a clear overlap) if they are further apart vertically
    const vertical = (xOverlap > 0 && xOverlap > yOverlap)
        || (!(yOverlap > 0 && yOverlap > xOverlap) && Math.abs(sourceCenter.x - targetCenter.x) <= Math.abs(sourceCenter.y - targetCenter.y));

    if (vertical) {
        const downwards = sourceCenter.y < targetCenter.y;
        return [
            { x: alongSide(source.x, source.width, target.x, target.width, index, count), y: downwards ? source.y + source.height : source.y },
            { x: alongSide(target.x, target.width, source.x, source.width, index, count), y: downwards ? target.y : target.y + target.height }
        ];
    }
    const rightwards = sourceCenter.x < targetCenter.x;
    return [
        { x: rightwards ? source.x + source.width : source.x, y: alongSide(source.y, source.height, target.y, target.height, index, count) },
        { x: rightwards ? target.x : target.x + target.width, y: alongSide(target.y, target.height, source.y, source.height, index, count) }
    ];
}

/**
 * Where the index-th of count relations leaves a side (from, length) towards the other class's side (otherFrom, otherLength):
 * around the middle of the range both sides share, or the corner nearest to the other class, spread evenly and kept off the corners
 */
function alongSide(from: number, length: number, otherFrom: number, otherLength: number, index: number, count: number): number {
    const sharedStart = Math.max(from, otherFrom);
    const sharedEnd = Math.min(from + length, otherFrom + otherLength);
    const aim = sharedStart < sharedEnd ? (sharedStart + sharedEnd) / 2 : (otherFrom >= from + length ? from + length : from);

    const gap = length / (count + 1);
    const halfGroup = (count - 1) * gap / 2;
    const groupCenter = Math.max(halfGroup + CORNER_MARGIN, Math.min(length - halfGroup - CORNER_MARGIN, aim - from));
    const position = groupCenter + (index - (count - 1) / 2) * gap;
    return from + Math.max(0, Math.min(length, position));
}

/** Length of the range two intervals share */
function overlap(from: number, length: number, otherFrom: number, otherLength: number): number {
    return Math.max(0, Math.min(from + length, otherFrom + otherLength) - Math.max(from, otherFrom));
}

function center(box: Box): Point {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
