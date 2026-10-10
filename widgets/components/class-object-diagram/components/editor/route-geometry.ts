export interface Point { x: number; y: number; }
export interface Box { x: number; y: number; width: number; height: number; }
/** Self-relations have the same source and target. */
export interface RelationEnds { source: string; target: string; }

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
