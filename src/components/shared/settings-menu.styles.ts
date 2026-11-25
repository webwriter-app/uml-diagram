import { css } from "lit";
/**
 * Shared styles for the settings menus shown in the options panel.
 * Options are grouped in sections with a small heading, using Shoelace defaults for all controls.
 */
export default css`

    :host {
        display: flex;
        flex-direction: column;
        gap: var(--sl-spacing-large);
        font-family: var(--sl-font-sans);
    }

    /* A group of related options with a small heading */
    .section {
        display: flex;
        flex-direction: column;
        gap: var(--sl-spacing-x-small);
    }

    /* Section heading, styled like a Shoelace menu label */
    .section-heading {
        margin: 0;
        font-size: var(--sl-font-size-small);
        font-weight: var(--sl-font-weight-semibold);
        color: var(--sl-color-neutral-500);
    }

    /* Hint below a heading, styled like Shoelace help text */
    .help-text {
        margin: 0;
        font-size: var(--sl-input-help-text-font-size-small);
        color: var(--sl-input-help-text-color);
    }

    sl-divider {
        --spacing: var(--sl-spacing-2x-small);
    }
`;
