import type { SlDropdown } from "@shoelace-style/shoelace";

/**
 * `sl-show` and `pointerdown` handler for a toolbar: closes all open dropdowns except the one the event came from.
 * Needed because the native mousedown Shoelace listens for doesn't get past the tooltips around the controls.
 */
export function closeOtherDropdowns(e: Event) {
    if (e.type === "sl-show" && (e.target as Element).tagName !== "SL-DROPDOWN") return;

    const path = e.composedPath();
    const toolbar = e.currentTarget as Element;
    for (const dropdown of toolbar.querySelectorAll<SlDropdown>("sl-dropdown")) {
        if (dropdown.open && !path.includes(dropdown)) {
            dropdown.hide();
        }
    }
}
