import { css } from "lit";
/**
 * Styles for the Global Settings Menu component.
 * General settings on top, followed by one expandable section per diagram type.
 * Section headings and help texts come from the shared settings menu styles.
 */
export default css`

    /* Space between the general settings and the diagram sections */
    :host {
        gap: var(--sl-spacing-large);
        overflow: visible !important;
    }

    /* Stacks the expandable diagram sections */
    .diagram-sections {
        display: flex;
        flex-direction: column;
        gap: var(--sl-spacing-x-small);
    }

    /* Section header: enable switch in front of the diagram name, same size as the other controls */
    .diagram-summary {
        display: flex;
        align-items: center;
        gap: var(--sl-spacing-x-small);
        font-size: var(--sl-input-font-size-small);
    }

    /* The header already has bottom padding, so keep the gap to the first section heading small */
    sl-details::part(content) {
        padding-top: 0;
    }

    /* The switch base is inline-flex with vertical-align: middle, so it sits slightly below the center of its line box.
       As a block-level flex box it takes exactly the height of the toggle, so it centers with the diagram name. */
    .diagram-summary sl-switch::part(base) {
        display: flex;
    }

    /* The header switch has no text of its own, so drop its (empty) label and the margin that comes with it */
    .diagram-summary sl-switch::part(label) {
        display: none;
    }
`;
