const selector = ':scope > script[type="application/json"][slot="data"]:not([src])';

export function readData(host: HTMLElement): Record<string, unknown> {
    const text = host.querySelector(selector)?.textContent;
    if (!text) return {};
    try {
        const value = JSON.parse(text);
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

export function writeData(host: HTMLElement, value: Record<string, unknown>) {
    const text = JSON.stringify(value).replace(/</g, '\\u003c');
    const current = host.querySelector(selector);
    if (current?.textContent === text) return;
    const block = current ?? host.ownerDocument.createElement('script');
    if (!current) {
        block.setAttribute('type', 'application/json');
        block.setAttribute('slot', 'data');
    }
    block.textContent = text;
    if (!current) host.append(block);
}
