/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import { cleanup, frames, modes, mount, sequenceReady, sequenceSnippet, sweep, tap, until } from "./helpers";
import { lifelineBounds, messageBounds, START_X, SLOT_SPACING } from "../src/model/sequence-diagram/sequence-rules";

mocha.setup(getMochaConfig());

/** The client position of a scene position, scrolled into the window first */
function point(scene: any, x: number, y: number): { x: number; y: number } {
  let at = scene.toClient(x, y);
  if (at.y < 20 || at.y > window.innerHeight - 20) {
    window.scrollBy(0, at.y - window.innerHeight / 2);
    at = scene.toClient(x, y);
  }
  return at;
}
const item = (editor: any, key: string) => editor.shadowRoot.querySelector(`[data-ww-key="${key}"]`) as HTMLElement;
/** The events the editor tells its controller about */
function record(editor: any, ...types: string[]) {
  const log: { type: string; detail: any }[] = [];
  for (const type of types) editor.addEventListener(type, (e: CustomEvent) => log.push({ type, detail: e.detail }));
  return log;
}

async function open(mode: "read" | "edit") {
  const host = await mount(mode, { html: sequenceSnippet });
  host.style.cssText = "display:block;width:1500px;height:900px";
  const parts = await sequenceReady(host);
  await frames(5);
  return { host, ...parts };
}

for (const mode of modes) {
  describe(`sequence diagram editor on Scene (${mode} mode)`, function () {
    this.timeout(30000);
    afterEach(cleanup);

    it("the canvas is a scene: every lifeline, message, activation and fragment is an item, and no svg or interact.js is left", async function () {
      const { editor } = await open(mode);
      const model = editor.model;
      assert.equal(editor.shadowRoot.querySelectorAll('ww-group[data-ww-key^="l:"]').length, model.lifelines.length, "lifelines");
      assert.equal(editor.shadowRoot.querySelectorAll('ww-group[data-ww-key^="m:"]').length, model.messages.length, "messages");
      assert.equal(editor.shadowRoot.querySelectorAll('ww-group[data-ww-key^="a:"]').length, model.lifelines.reduce((n: number, l: any) => n + l.activations.length, 0), "activations");
      assert.equal(editor.shadowRoot.querySelectorAll('ww-group[data-ww-key^="f:"]').length, model.fragments.length, "fragments");
      assert.isNull(editor.shadowRoot.querySelector("svg#canvas"), "no svg canvas");
      assert.isNull(editor.shadowRoot.querySelector("[data-bound]"), "nothing is bound by interact.js");
      const first = model.lifelines[0];
      const group = item(editor, `l:${first.id}`);
      assert.equal(Number(group.getAttribute("x")), START_X - 70, "the first lifeline is in the first slot");
      assert.equal(group.getAttribute("axis"), "x", "a lifeline moves sideways only");
      assert.equal(item(editor, `m:${model.messages[0].id}`).getAttribute("axis"), "y", "a message moves up and down only");
    });

    it("a message is dragged up and down only, stays within its bounds and the widget is told", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "update-message");
      const message = editor.model.messages.find((m: any) => m.id === "msg-1");
      const bounds = messageBounds(editor.model, message.sourceId, message.targetId, message.type, message.id);
      const from = point(scene, 200, message.y);
      await sweep(scene, from, { x: from.x + 80, y: from.y + 40 });
      await until(() => log.length > 0, "update-message");
      assert.equal(log[0].detail.id, "msg-1");
      assert.closeTo(log[0].detail.y, message.y + 40, 2, "moved by the vertical part of the drag");
      assert.isUndefined(log[0].detail.x, "the horizontal part is ignored");
      log.length = 0;
      const again = point(scene, 200, message.y + 40);
      await sweep(scene, again, { x: again.x, y: again.y - 900 });
      await until(() => log.length > 0, "update-message at the limit");
      assert.equal(log[0].detail.y, bounds.minY, "stopped at the lowest allowed place");
    });

    it("a lifeline is dragged sideways, the others make room while it is held and it takes its slot on the drop", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "reorder-lifeline");
      const [member, terminal] = editor.model.lifelines;
      const from = point(scene, START_X, member.y + 40);
      let during = -1;
      await sweep(scene, from, { x: from.x + SLOT_SPACING + 10, y: from.y + 30 }, async () => {
        during = Number(item(editor, `l:${terminal.id}`).getAttribute("x"));
      });
      assert.equal(during, START_X - 70, "the second lifeline stepped into the first slot while the first is held");
      await until(() => log.length > 0, "reorder");
      assert.deepEqual(log[0].detail, { id: member.id, shift: 1 });
      await until(() => Number(item(editor, `l:${member.id}`).getAttribute("x")) === START_X + SLOT_SPACING - 70, "it takes the second slot");
      assert.equal(Number(item(editor, `l:${terminal.id}`).getAttribute("x")), START_X - 70, "and the other the first");
    });

    it("a lifeline can also be dragged by its line area, which is hit although nothing visible is drawn there", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "reorder-lifeline");
      const first = editor.model.lifelines[0].id;
      const from = point(scene, START_X, 420);
      await sweep(scene, from, { x: from.x + SLOT_SPACING, y: from.y });
      await until(() => log.length > 0, "reorder by the line area");
      assert.deepEqual(log[0].detail, { id: first, shift: 1 });
    });

    it("the length of a lifeline, an activation and a fragment region is changed at their handles", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "update-lifeline", "update-activation", "update-fragment");
      const handles = () => [...scene.shadowRoot.querySelectorAll("[part=resize]")] as SVGElement[];
      const near = (client: { x: number; y: number }) => handles().map((h) => ({ h, box: h.getBoundingClientRect() }))
        .sort((a, b) => Math.hypot(a.box.x + a.box.width / 2 - client.x, a.box.y + a.box.height / 2 - client.y) - Math.hypot(b.box.x + b.box.width / 2 - client.x, b.box.y + b.box.height / 2 - client.y))[0].box;
      const grab = async (client: { x: number; y: number }, dy: number) => {
        const box = near(client);
        const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await sweep(scene, at, { x: at.x, y: at.y + dy });
      };
      // the lifeline of the terminal: its body ends at its handle
      const terminal = editor.model.lifelines[1];
      await grab(point(scene, START_X + SLOT_SPACING, terminal.y + terminal.length), 30);
      await until(() => log.some((e) => e.type === "update-lifeline"), "lifeline resized");
      assert.closeTo(log.find((e) => e.type === "update-lifeline")!.detail.length, terminal.length + 30, 2);
      // the bottom edge of the activation of the terminal
      const act = terminal.activations[0];
      await grab(point(scene, START_X + SLOT_SPACING, act.y + act.length), -40);
      await until(() => log.some((e) => e.type === "update-activation"), "activation resized");
      const resized = log.find((e) => e.type === "update-activation")!.detail;
      assert.equal(resized.activationId, act.id);
      assert.closeTo(resized.length, act.length - 40, 2);
      assert.equal(resized.y, act.y, "its top stays");
      // the first region of the fragment, at its top edge
      const fragment = editor.model.fragments[0];
      await grab(point(scene, START_X - 85 + (SLOT_SPACING * 3 + 235) / 2, fragment.y), 20);
      await until(() => log.some((e) => e.type === "update-fragment"), "fragment resized");
      const region = log.find((e) => e.type === "update-fragment")!.detail;
      assert.closeTo(region.y, fragment.y + 20, 2, "the fragment starts lower");
      assert.closeTo(region.operands[0].height, fragment.operands[0].height - 20, 2, "and its first region is shorter by the same");
    });

    it("the box of a lifeline that a create message makes follows the message while it is dragged", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "update-message", "update-lifeline");
      const create = editor.model.messages.find((m: any) => m.type === "create");
      const target = editor.model.lifelines.find((l: any) => l.id === create.targetId);
      const from = point(scene, 450, create.y + 40);
      let during = 0;
      await sweep(scene, from, { x: from.x, y: from.y + 30 }, async () => { during = Number(item(editor, `l:${target.id}`).getAttribute("y")); });
      assert.closeTo(during, target.y + 30, 2, "the box moved with the message before it was dropped");
      await until(() => log.some((e) => e.type === "update-lifeline"), "lifeline updated");
      const moved = log.find((e) => e.type === "update-lifeline")!.detail;
      assert.closeTo(moved.y, target.y + 30, 2);
      assert.closeTo(moved.y + moved.length, target.y + target.length, 2, "its end stays where it was");
    });

    it("an activation moves along its lifeline and a fragment up and down by its header, both only vertically", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "update-activation", "update-fragment");
      const terminal = editor.model.lifelines[1];
      const act = terminal.activations[0];
      const bounds = lifelineBounds(editor.model, terminal.id);
      const from = point(scene, START_X + SLOT_SPACING, act.y + act.length / 2);
      await sweep(scene, from, { x: from.x + 100, y: from.y + 5000 });
      await until(() => log.some((e) => e.type === "update-activation"), "activation moved");
      assert.equal(log[0].detail.y, bounds.maxY - act.length, "it stops at the end of its lifeline");
      const fragment = editor.model.fragments[0];
      const left = START_X - 85;
      const header = point(scene, left + 20, fragment.y + 10);
      await sweep(scene, header, { x: header.x + 50, y: header.y + 15 });
      await until(() => log.some((e) => e.type === "update-fragment"), "fragment moved");
      const moved = log.find((e) => e.type === "update-fragment")!.detail;
      assert.closeTo(moved.y, fragment.y + 15, 2);
      assert.isUndefined(moved.x);
    });

    it("a fragment that is dragged over another is marked at once and the mark goes when it is let go", async function () {
      const { host, editor, scene } = await open(mode);
      editor.globalSettings = Object.assign(Object.create(Object.getPrototypeOf(editor.globalSettings)), editor.globalSettings, { validationMode: "all" });
      editor.settings = Object.assign(Object.create(Object.getPrototypeOf(editor.settings)), editor.settings, { checkForFragmentOverlap: true });
      const model = editor.model;
      model.fragments = [...model.fragments, { id: "frag-extra", type: "opt", startLifelineId: model.lifelines[0].id, endLifelineId: model.lifelines[1].id, y: 150, operands: [{ id: "op-extra", guard: "[x]", height: 60 }] }];
      editor.requestUpdate();
      await editor.updateComplete;
      await frames(4);
      const marked = () => [...editor.shadowRoot.querySelectorAll("ww-shape.fragment-background.overlapping")].length;
      assert.equal(marked(), 0, "none overlaps at first");
      const header = point(scene, START_X - 85 + 20, 160);
      let during = 0;
      await sweep(scene, header, { x: header.x, y: header.y + 80 }, async () => { during = marked(); });
      assert.isAtLeast(during, 2, "both fragments are marked while the drag is on");
      await until(() => marked() === 0, "the mark goes with the drag");
      host.remove();
    });

    it("in the interaction modes a click on a lifeline gives the height, and a double click opens the drawer of what is pressed", async function () {
      const { editor, scene } = await open(mode);
      const log = record(editor, "add-activation-at");
      editor.interactionMode = "add-activation";
      await editor.updateComplete;
      await frames(3);
      assert.isFalse(item(editor, "l:ll-member").hasAttribute("movable"), "nothing is moved while a lifeline is picked");
      await tap(scene, point(scene, START_X + 2 * SLOT_SPACING, 500));
      await until(() => log.length > 0, "add-activation-at");
      assert.equal(log[0].detail.id, editor.model.lifelines[2].id);
      assert.closeTo(log[0].detail.y, 500, 2);
      editor.interactionMode = "idle";
      await editor.updateComplete;
      await frames(3);
      const message = editor.model.messages[0];
      await tap(scene, point(scene, 200, message.y), 2);
      await until(() => editor.editingMessageId === message.id, "message drawer");
      const context = new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: point(scene, START_X, 100).x, clientY: point(scene, START_X, 100).y });
      item(editor, `lh:${editor.model.lifelines[0].id}`).dispatchEvent(context);
      await until(() => editor.editingLifelineId === editor.model.lifelines[0].id, "lifeline drawer");
      assert.isTrue(context.defaultPrevented, "the browser's menu stays away");
    });

    it("the plain wheel zooms the canvas around the pointer and the zoom buttons stay within their limits", async function () {
      const { editor, scene } = await open(mode);
      const zoom = () => editor.shadowRoot.querySelector("zoom-controls").zoomLevel as number;
      const box = scene.getBoundingClientRect();
      const at = { clientX: box.left + 300, clientY: box.top + 300 };
      scene.dispatchEvent(new WheelEvent("wheel", { bubbles: true, composed: true, cancelable: true, deltaY: -200, ...at }));
      await until(() => zoom() > 1, "zoomed in");
      for (let i = 0; i < 40; i++) scene.dispatchEvent(new WheelEvent("wheel", { bubbles: true, composed: true, cancelable: true, deltaY: 400, ...at }));
      await until(() => zoom() <= 0.31, "zoomed out to the limit");
      assert.isAtLeast(zoom(), 0.3 - 1e-6);
    });
  });
}

mocha.run();
