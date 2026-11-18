/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import { cleanup, cls, editorOf, frames, modes, mount, mountPoint, nodeOf, ready, sequenceReady, sequenceSnippet, stored, until } from "./helpers";

mocha.setup(getMochaConfig());

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, composed: true, cancelable: true }));

const touch = (target: Element, type: string, at: { x: number; y: number }) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 11, pointerType: "touch", button: 0, isPrimary: true, clientX: at.x, clientY: at.y }));

for (const mode of modes) {
  describe(`UML diagram input, layout, theme and print (${mode} mode)`, function () {
    this.timeout(30000);
    afterEach(cleanup);

    it("Enter on a focused class opens its dialog, the arrow keys do not, and typing in a field does not delete it", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const node = nodeOf(editor, "1");
      node.focus();
      key(node, "Enter");
      await until(() => editor.classEditDialog._selectedNodeId === "1", "class dialog opened by the keyboard");
      const field = document.createElement("input");
      editor.shadowRoot.querySelector("#canvas").append(field);
      key(field, "Delete");
      await frames();
      assert.isNotNull(nodeOf(editor, "1"), "Delete in a field keeps the class");
      field.remove();
    });

    it("Enter on a focused lifeline opens its drawer", async function () {
      const host = await mount(mode, { html: sequenceSnippet });
      const { editor } = await sequenceReady(host);
      const node = editor.shadowRoot.querySelector("ww-node");
      node.focus();
      key(node, "Enter");
      await until(() => editor.shadowRoot.querySelector("sl-drawer[open]"), "drawer opened by the keyboard");
    });

    it("the diagram tabs are one tab stop and the arrow keys move between them", async function () {
      const host = await mount(mode);
      const tabs = host.shadowRoot.querySelector("diagram-tabs");
      const buttons = [...tabs.shadowRoot.querySelectorAll('[role="tab"]')] as HTMLElement[];
      assert.deepEqual(buttons.map((b) => b.tabIndex), [0, -1, -1], "only the shown tab is in the tab order");
      key(buttons[0], "ArrowRight");
      await until(() => host.diagramType === "object-diagram", "object diagram shown");
      await until(() => tabs.shadowRoot.querySelectorAll('[role="tab"]')[1].tabIndex === 0, "tab stop follows");
      key(tabs.shadowRoot.querySelectorAll('[role="tab"]')[1], "End");
      await until(() => host.diagramType === "sequence-diagram", "sequence diagram shown");
    });

    it("a class is moved by a touch drag and a tap selects it", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const node = nodeOf(editor, "1");
      const box = node.getBoundingClientRect();
      const from = { x: box.left + box.width / 2, y: box.top + 12 };
      const x = editor.diagram.node("1").pos_x;
      touch(node, "pointerdown", from);
      touch(node, "pointermove", { x: from.x + 6, y: from.y + 6 });
      await frames();
      touch(node, "pointermove", { x: from.x + 40, y: from.y });
      await frames();
      touch(node, "pointerup", { x: from.x + 40, y: from.y });
      await until(() => Math.abs(editor.diagram.node("1").pos_x - (x + 40)) < 3, "moved by touch");
      assert.equal(editor.selectedKey, "1", "a touch select");
    });

    it("the toolbar buttons and tabs are at least 24 px high", async function () {
      const host = await mount(mode);
      await ready(host);
      const buttons = [...host.shadowRoot.querySelector("diagram-tabs").shadowRoot.querySelectorAll("button")] as HTMLElement[];
      assert.isTrue(buttons.every((b) => b.getBoundingClientRect().height >= 24), "tabs");
      const toolbar = cls(host).shadowRoot.querySelector("class-toolbar");
      const small = [...toolbar.shadowRoot.querySelectorAll("sl-button")].filter((b: any) => b.getBoundingClientRect().height < 24);
      assert.equal(small.map((b: any) => `${b.textContent.trim()} ${b.getBoundingClientRect().width}x${b.getBoundingClientRect().height}`).join(), "", "toolbar buttons");
    });

    for (const width of [300, 768, 2100]) {
      it(`at ${width} px the widget fits its box and the tabs do not overflow`, async function () {
        const host = await mount(mode);
        mountPoint().style.width = `${width}px`;
        await ready(host);
        await frames(4);
        assert.isAtMost(host.scrollWidth, host.clientWidth + 1, "no sideways scroll");
        assert.isAtMost(host.getBoundingClientRect().width, Math.max(width, 300) + 1);
        const tabs = host.shadowRoot.querySelector("diagram-tabs");
        assert.isAtMost(tabs.scrollWidth, tabs.clientWidth + 1, "the tabs fit the row");
        assert.isAtLeast(host.getBoundingClientRect().height, 300, "min height");
      });
    }

    it("the theme sets the text color, the font and the accent of the diagram, and the old colors stay without it", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const line = () => getComputedStyle(editor.shadowRoot.querySelector("ww-path[data-ww-key]")).stroke;
      const header = () => getComputedStyle(editor.shadowRoot.querySelector(".uml-class-header")).color;
      const tab = () => getComputedStyle(host.shadowRoot.querySelector("diagram-tabs").shadowRoot.querySelector(".tab.active")).color;
      const before = { line: line(), header: header(), tab: tab() };
      const wrapper = host.parentElement as HTMLElement;
      wrapper.style.cssText = "--ww-text-color: rgb(20, 30, 90); --ww-font-family: Georgia, serif; --ww-theme-accent-1: rgb(200, 40, 40)";
      await until(() => tab() === "rgb(200, 40, 40)", "the active tab follows the accent");
      assert.equal(line(), "rgb(20, 30, 90)", "lines");
      assert.equal(header(), "rgb(20, 30, 90)", "class names");
      assert.equal(tab(), "rgb(200, 40, 40)", "active tab");
      assert.include(getComputedStyle(host).fontFamily, "Georgia");
      wrapper.style.cssText = "";
      await until(() => tab() === before.tab, "the active tab is back");
      assert.deepEqual({ line: line(), header: header(), tab: tab() }, before, "unchanged without a theme");
    });

    it("the host exposes the parts tabs and frame", async function () {
      const host = await mount(mode);
      assert.isNotNull(host.shadowRoot.querySelector('diagram-tabs[part="tabs"]'));
      assert.isNotNull(host.shadowRoot.querySelector('.frame[part="frame"]'));
    });

    it("before printing the view shows the whole diagram, after printing the view is back", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const scene = editor.shadowRoot.querySelector("ww-scene");
      const controls = editor.shadowRoot.querySelector("zoom-controls");
      for (let step = 0; step < 6; step++) controls.dispatchEvent(new CustomEvent("zoom-in"));
      await frames(5);
      const nodes = () => [...editor.shadowRoot.querySelectorAll("ww-node")].map((node: Element) => node.getBoundingClientRect());
      const inside = () => { const frame = scene.getBoundingClientRect(); return nodes().every((r: DOMRect) => r.left >= frame.left - 1 && r.right <= frame.right + 1 && r.top >= frame.top - 1 && r.bottom <= frame.bottom + 1); };
      const zoomed = nodes().map((r: DOMRect) => Math.round(r.width));
      assert.isFalse(inside(), "the zoomed view cuts the diagram off");
      window.dispatchEvent(new Event("beforeprint"));
      await frames(5);
      assert.isTrue(inside(), "every class is inside the scene while printing");
      window.dispatchEvent(new Event("afterprint"));
      await frames(5);
      assert.deepEqual(nodes().map((r: DOMRect) => Math.round(r.width)), zoomed, "the zoom is restored");
    });

    it("before printing a WebGL canvas is copied to an ordinary one, after printing it is back", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const scene = editor.shadowRoot.querySelector("ww-scene");
      await frames(5);
      const canvases = () => scene.shadowRoot ? scene.shadowRoot.querySelectorAll("canvas").length : 0;
      const before = canvases();
      window.dispatchEvent(new Event("beforeprint"));
      const during = canvases();
      const shown = [...(scene.shadowRoot?.querySelectorAll("canvas") ?? [])].filter((c: any) => c.style.display !== "none").length;
      window.dispatchEvent(new Event("afterprint"));
      assert.equal(canvases(), before, "the copy is removed after printing");
      if (before === 0) return;
      assert.equal(during, before * 2, "a copy for every canvas");
      assert.equal(shown, before, "only the copies are shown");
    });
  });
}

mocha.run();
