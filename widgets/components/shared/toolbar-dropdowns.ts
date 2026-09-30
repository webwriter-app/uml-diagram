import type { SlDropdown } from "@shoelace-style/shoelace";

/**
 * `sl-show` handler for a toolbar: when one of its dropdowns opens, close all others,
 * so only one menu is open at a time.
 */
export function closeOtherDropdowns(e: Event) {
    const opened = e.target as Element;
    if (opened.tagName !== "SL-DROPDOWN") return;

    const toolbar = e.currentTarget as Element;
    for (const dropdown of toolbar.querySelectorAll<SlDropdown>("sl-dropdown")) {
        if (dropdown !== opened && dropdown.open) {
            dropdown.hide();
        }
    }
}
