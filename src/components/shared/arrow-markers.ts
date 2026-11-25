import { svg } from "lit";

/** shape, viewBox size and tip (reference point) of every arrow head; lines reference them with url(#id) */
const heads: { id: string, width: number, height: number, refX: number, path: string, fill: string }[] = [
    { id: 'arrow-open',           width: 14, height: 14, refX: 12, path: 'M 1 1 L 12 7 L 1 13',        fill: 'none' },
    { id: 'arrow-filled',         width: 14, height: 14, refX: 12, path: 'M 1 1 L 12 7 L 1 13 Z',      fill: 'context-stroke' },
    { id: 'arrow-triangle',       width: 16, height: 16, refX: 15, path: 'M 1 1 L 15 8 L 1 15 Z',      fill: 'var(--sl-color-neutral-0)' },
    { id: 'arrow-diamond-hollow', width: 18, height: 14, refX: 17, path: 'M 1 7 L 9 1 L 17 7 L 9 13 Z', fill: 'var(--sl-color-neutral-0)' },
    { id: 'arrow-diamond-filled', width: 18, height: 14, refX: 17, path: 'M 1 7 L 9 1 L 17 7 L 9 13 Z', fill: 'context-stroke' },
];

/**
 * Renders the arrow head markers shared by all diagrams, to be placed inside an svg `<defs>`.
 * The heads take the color of their line (context-stroke), with a neutral color fallback for Safari,
 * so they follow hover/selection where supported, and are sized in pixels
 * (userSpaceOnUse) so they don't scale with the line width. `strokeWidth` should match the width of the lines.
 * They point along the line at its end and are flipped at its start (auto-start-reverse), so every marker
 * can be used as marker-end and marker-start.
 */
export function arrowMarkers(strokeWidth: number) {
    return heads.map(head => svg`
        <marker
            id=${head.id}
            viewBox="0 0 ${head.width} ${head.height}"
            markerWidth=${head.width}
            markerHeight=${head.height}
            refX=${head.refX}
            refY=${head.height / 2}
            markerUnits="userSpaceOnUse"
            overflow="visible"
            orient="auto-start-reverse">
            <path
                d=${head.path}
                fill=${head.fill === 'context-stroke' ? 'var(--sl-color-neutral-900)' : head.fill}
                style="stroke: var(--sl-color-neutral-900); stroke: context-stroke; ${head.fill === 'context-stroke' ? 'fill: context-stroke;' : ''}"
                stroke-width=${strokeWidth}
                stroke-linejoin="round" />
        </marker>
    `);
}
