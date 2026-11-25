import snippet from "../snippets/library-loan.html";
import "../src/widgets/webwriter-uml-diagram";

export { snippet };

export type Mode = "read" | "edit";
export const modes: Mode[] = ["read", "edit"];

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until<T>(fn: () => T, what: string, ms = 8000): Promise<NonNullable<T>> {
  const end = Date.now() + ms;
  for (;;) {
    let value: T | undefined;
    try { value = fn(); } catch { value = undefined; }
    if (value) return value as NonNullable<T>;
    if (Date.now() > end) throw new Error("timeout waiting for " + what);
    await wait(25);
  }
}

export const frames = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame); };

export function mountPoint() {
  let element = document.getElementById("mount");
  if (!element) {
    element = document.createElement("div");
    element.id = "mount";
    document.body.append(element);
  }
  return element;
}

export function cleanup() {
  document.getElementById("mount")?.remove();
  document.designMode = "off";
}

export async function mount(mode: Mode, { html = snippet, lang }: { html?: string; lang?: string } = {}): Promise<any> {
  const point = mountPoint();
  point.innerHTML = html;
  const host = point.firstElementChild as any;
  if (lang) host.setAttribute("lang", lang);
  if (mode === "edit") { host.setAttribute("contenteditable", ""); document.designMode = "on"; }
  else document.designMode = "off";
  await host.updateComplete;
  await until(() => host.shadowRoot?.querySelector("sequence-diagram-container"), "container");
  return host;
}

export const block = (host: Element) => host.querySelector(':scope > script[type="application/json"][slot="data"]') as HTMLScriptElement;
export const data = (host: Element) => JSON.parse(block(host).textContent!);
export const seq = (host: any) => host.shadowRoot.querySelector("sequence-diagram-container");
export const cls = (host: any) => host.shadowRoot.querySelector('class-object-container[diagramtype="class-diagram"]');
export const tabsText = (host: any) => host.shadowRoot.querySelector("diagram-tabs").shadowRoot.textContent.replace(/\s+/g, " ").trim();

export const editorOf = (host: any) => cls(host).shadowRoot.querySelector("uml-editor");
export const nodeOf = (editor: any, id: string) => editor.shadowRoot.querySelector(`ww-node[data-ww-key="${id}"]`);
export const stored = (host: any) => JSON.parse(host.classDiagramData).drawflow.Home.data;

const centre = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
export const pointer = (target: Element, type: string, at: { x: number; y: number }) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 7, button: 0, isPrimary: true, clientX: at.x, clientY: at.y }));

export async function click(target: Element) {
  const at = centre(target);
  pointer(target, "pointerdown", at);
  pointer(target, "pointerup", at);
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1, clientX: at.x, clientY: at.y }));
  await frames();
}

export async function dragBy(target: Element, dx: number, dy: number, midway?: () => Promise<void>) {
  const from = centre(target);
  const editor = (target.getRootNode() as ShadowRoot).host;
  const scale = (editor.shadowRoot?.querySelector("zoom-controls") as any)?.zoomLevel ?? 1;
  pointer(target, "pointerdown", from);
  pointer(target, "pointermove", { x: from.x + 8, y: from.y + 8 });
  await frames();
  pointer(target, "pointermove", { x: from.x + dx * scale, y: from.y + dy * scale });
  await frames();
  await midway?.();
  pointer(target, "pointerup", { x: from.x + dx * scale, y: from.y + dy * scale });
  await frames();
}

export async function ready(host: any) {
  const editor = editorOf(host);
  await until(() => editor.diagram.classes.length > 0 && editor.shadowRoot.querySelectorAll("ww-path[data-ww-key]").length === editor.diagram.relations().length, "relations drawn between measured nodes");
  return editor;
}

/** The snippet with the sequence diagram open */
export const sequenceSnippet = snippet.replace('diagram-type="class-diagram"', 'diagram-type="sequence-diagram"');

export const sequenceEditorOf = (host: any) => seq(host).shadowRoot.querySelector("sequence-editor");

/** What the pointer really hits at a client position, through every shadow root */
export function under(scene: any, at: { x: number; y: number }): Element {
  scene.render?.();
  let element = document.elementFromPoint(at.x, at.y)!;
  for (;;) {
    const inner = element.shadowRoot?.elementFromPoint(at.x, at.y);
    if (!inner || inner === element) return element;
    element = inner;
  }
}

/** A drag that starts on what is really at `from` (client coordinates) and ends at `to` */
export async function sweep(scene: any, from: { x: number; y: number }, to: { x: number; y: number }, midway?: () => Promise<void> | void) {
  const target = under(scene, from);
  pointer(target, "pointerdown", from);
  pointer(target, "pointermove", { x: from.x + 6, y: from.y + 6 });
  await frames();
  pointer(target, "pointermove", to);
  await frames();
  await midway?.();
  pointer(target, "pointerup", to);
  await frames();
}

/** Presses and releases on what is really at `at` */
export async function tap(scene: any, at: { x: number; y: number }, times = 1) {
  for (let i = 0; i < times; i++) {
    const target = under(scene, at);
    pointer(target, "pointerdown", at);
    pointer(target, "pointerup", at);
    await frames();
  }
}

export async function sequenceReady(host: any) {
  const editor = sequenceEditorOf(host);
  const scene = editor.shadowRoot.querySelector("ww-scene");
  await until(() => editor.model.lifelines.length > 0 && scene.getBoundingClientRect().width > 0 && editor.shadowRoot.querySelector("ww-node"), "sequence drawn");
  await frames(5);
  return { editor, scene };
}
