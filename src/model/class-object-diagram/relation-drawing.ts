import type { Point } from "./route-geometry";

/** What sits at the end and at the start of the line of a relation of a type (the markers of `ww-path`) */
export const MARKERS: Record<string, { start?: string; end?: string }> = {
    'association': { end: 'open-arrow' },
    'association-bidirectional': { start: 'open-arrow', end: 'open-arrow' },
    'inheritance': { end: 'triangle' },
    'realization': { end: 'triangle' },
    'dependency': { end: 'open-arrow' },
    'composition': { end: 'diamond-filled' },
    'aggregation': { end: 'diamond' },
};

/** Types whose line is dashed */
export const DASHED_TYPES = ['realization', 'dependency'];

/** The point on the border of a class box that is nearest to a point of a relation; inside the box the top right corner */
export function boxAnchor(box: { x: number; y: number; width: number; height: number }, point: Point): Point {
    const left = box.x;
    const right = box.x + box.width;
    const top = box.y;
    const bottom = box.y + box.height;
    const clampY = (y: number) => y < top ? top : y > bottom ? bottom : y;
    if (point.x < left) return { x: left, y: clampY(point.y) };
    if (point.x > right) return { x: right, y: clampY(point.y) };
    if (point.y < top) return { x: point.x, y: top };
    if (point.y > bottom) return { x: point.x, y: bottom };
    return { x: right, y: top };
}
