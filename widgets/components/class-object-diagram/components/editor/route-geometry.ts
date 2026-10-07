/** Geometry of relation routes: self-relation loops and helpers to measure and draw routes */

export interface Point { x: number; y: number; }
export interface Box { x: number; y: number; width: number; height: number; }
/** The classes a relation connects (both the same for a self-relation) */
export interface RelationEnds { source: string; target: string; }

/** Self-relations are loops on the left side of their class, how far they reach out from it and how tall they are */
const SELF_RELATION_LOOP_SIZE = 40;

/** The loops of all self-relations, by relation id */
export function selfRelationLoops(boxes: Map<string, Box>, relations: Map<string, RelationEnds>): Map<string, Point[]> {
    const loops = new Map<string, Point[]>();
    const selfRelations = [...relations].filter(([, ends]) => ends.source === ends.target && boxes.has(ends.source));
    // in the order they were created (the ids start with the id of their proxy node)
    selfRelations.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    const counts = new Map<string, number>();
    selfRelations.forEach(([, { source }]) => counts.set(source, (counts.get(source) ?? 0) + 1));
    const indices = new Map<string, number>();
    for (const [id, { source }] of selfRelations) {
        const index = indices.get(source) ?? 0;
        indices.set(source, index + 1);
        loops.set(id, selfRelationLoop(boxes.get(source)!, index, counts.get(source)!));
    }
    return loops;
}

/** The loop of the index-th of count self-relations of a class: out of its left side and back in below, spread evenly along the side */
function selfRelationLoop(box: Box, index: number, count: number): Point[] {
    const center = box.y + box.height * (index + 1) / (count + 1);
    const top = Math.max(box.y, center - SELF_RELATION_LOOP_SIZE / 2);
    const bottom = center + SELF_RELATION_LOOP_SIZE / 2;
    const outside = box.x - SELF_RELATION_LOOP_SIZE;
    return [
        { x: box.x, y: top },
        { x: outside, y: top },
        { x: outside, y: bottom },
        { x: box.x, y: bottom }
    ];
}

/** Whether the route segment from a to b is horizontal */
function isHorizontal(a: Point, b: Point) {
    return Math.abs(a.y - b.y) < Math.abs(a.x - b.x);
}

/** The point halfway along a route and the segment it lies on */
export function routeMidpoint(route: Point[]): { point: Point, horizontal: boolean } {
    const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
        if (remaining <= lengths[i] || i === lengths.length - 1) {
            const [a, b] = [route[i], route[i + 1]];
            const t = lengths[i] > 0 ? Math.min(remaining / lengths[i], 1) : 0;
            return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, horizontal: isHorizontal(a, b) };
        }
        remaining -= lengths[i];
    }
    return { point: route[0], horizontal: true };
}

/** Converts a route into SVG path data */
export function routeToPath(route: Point[]) {
    return route.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}
