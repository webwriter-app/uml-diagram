/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import { cleanup, click, dragBy, modes, mount, nodeOf, ready, stored, until } from "./helpers";

mocha.setup(getMochaConfig());

for (const mode of modes) {
  describe(`class diagram editor on Scene (${mode} mode)`, function () {
    this.timeout(30000);
    afterEach(cleanup);

    it("every stored class is a node and every relation a path, with labels and heads", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const data = stored(host);
      const classes = Object.values<any>(data).filter((n) => !n.data.isProxy);
      assert.equal(editor.shadowRoot.querySelectorAll("ww-node").length, classes.length, "one node per class");
      assert.isTrue(classes.every((n) => { const el = nodeOf(editor, n.id); return el && Number(el.getAttribute("x")) === n.pos_x && Number(el.getAttribute("y")) === n.pos_y; }), "nodes at the stored place");
      const relations = Object.values<any>(data).flatMap((n) => Object.values<any>(n.outputs).flatMap((o) => o.connections));
      assert.equal(editor.shadowRoot.querySelectorAll("ww-path[data-ww-key]").length, relations.length, "one path per relation");
      const paths = [...editor.shadowRoot.querySelectorAll("ww-path[data-ww-key]")] as any[];
      assert.isTrue(paths.every((p) => p.hasAttribute("from") && p.hasAttribute("to") && p.attached), "every relation is attached to its classes");
      assert.isTrue(paths.every((p) => p.getAttribute("hit-width") === "30"), "a wide hit band");
      assert.isTrue(paths.some((p) => (p.getAttribute("marker-end") ?? "none") !== "none"), "arrowheads are markers of the path");
      assert.isNull(editor.shadowRoot.querySelector("ww-shape"), "no shapes for heads");
      assert.isTrue([...editor.shadowRoot.querySelectorAll("ww-path > ww-text")].some((t: any) => t.textContent.trim() === "borrows"), "relation name is a label of its path");
      assert.isNull(editor.shadowRoot.querySelector(".drawflow"), "no drawflow");
    });

    it("dragging a class moves it as one transaction, the relations follow, the widget stores it", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const log: string[] = [];
      for (const type of ["ww-transactionstart", "ww-move", "ww-transactionend"]) editor.addEventListener(type, () => log.push(type));
      const first = editor.diagram.relations().find((r: any) => r.from === "1" || r.to === "1");
      const scene = editor.shadowRoot.querySelector("ww-scene");
      const path = () => ({ points: scene.drawingOf(editor.shadowRoot.querySelector(`ww-path[data-ww-key="${first.id}"]`)).points });
      const before = JSON.stringify(path().points);
      const x = editor.diagram.node("1").pos_x;
      let live = "";
      await dragBy(nodeOf(editor, "1"), 40, 30, async () => { live = JSON.stringify(path().points); });
      await until(() => Math.abs(editor.diagram.node("1").pos_x - (x + 40)) < 2, "model moved");
      assert.equal(log.join(), "ww-transactionstart,ww-move,ww-transactionend", "events");
      assert.notEqual(live, before, "the relation followed during the drag");
      assert.notEqual(JSON.stringify(path().points), before, "the relation follows after the drop");
      assert.isNull(editor.shadowRoot.querySelector("ww-path[data-ww-key]").points, "the relation is not drawn from points of the widget");
      await until(() => Math.abs(stored(host)[1].pos_x - (x + 40)) < 2, "stored by the widget");
    });

    it("the library draws the heads, the labels and the grid: markers, label halo, wide hit band, dots", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const scene = editor.shadowRoot.querySelector("ww-scene");
      const drawings = [...editor.shadowRoot.querySelectorAll("ww-path[data-ww-key]")].map((p: any) => ({ p, d: scene.drawingOf(p) }));
      assert.isTrue(drawings.some(({ d }) => d.markers.length > 0), "markers are drawn");
      const inside = (key: string, point: { x: number; y: number }) => {
        const box = nodeOf(editor, key).getBoundingClientRect();
        const at = scene.toScene(box.left, box.top);
        return point.x > at.x + 3 && point.x < at.x + box.width - 3 && point.y > at.y + 3 && point.y < at.y + box.height - 3;
      };
      assert.isTrue(drawings.filter(({ p }) => p.getAttribute("from") !== p.getAttribute("to")).every(({ p, d }) =>
        !inside(p.getAttribute("from"), d.points[0]) && !inside(p.getAttribute("to"), d.points[d.points.length - 1])), "a line meets the outline of its classes and does not run into them");
      assert.isTrue(drawings.every(({ d }) => d.hit === 30), "the hit band is 30 px wide");
      const named = drawings.find(({ p }) => p.querySelector("ww-text"))!;
      assert.equal(named.d.labels.length, named.p.querySelectorAll("ww-text").length, "every text is a label on the line");
      assert.equal(getComputedStyle(named.p.querySelector("ww-text")).strokeWidth, "4px", "a halo behind the labels");
      assert.equal(scene.getAttribute("background"), "dots", "the grid is the scene's");
    });

    it("the plain wheel zooms the canvas", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const scene = editor.shadowRoot.querySelector("ww-scene");
      const zoom = () => editor.shadowRoot.querySelector("zoom-controls").zoomLevel as number;
      const before = zoom();
      const rect = scene.getBoundingClientRect();
      scene.dispatchEvent(new WheelEvent("wheel", { bubbles: true, composed: true, cancelable: true, deltaY: -120, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      await until(() => zoom() > before, "zoomed in");
      scene.dispatchEvent(new WheelEvent("wheel", { bubbles: true, composed: true, cancelable: true, deltaY: 400, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      await until(() => zoom() < before + 0.05, "zoomed out");
    });

    it("the relations follow a class that is moved with the keyboard", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const scene = editor.shadowRoot.querySelector("ww-scene");
      const first = editor.diagram.relations().find((r: any) => r.from === "1" || r.to === "1");
      const line = () => JSON.stringify(scene.drawingOf(editor.shadowRoot.querySelector(`ww-path[data-ww-key="${first.id}"]`)).points);
      const before = line();
      const x = editor.diagram.node("1").pos_x;
      await click(nodeOf(editor, "1"));
      await until(() => nodeOf(editor, "1").hasAttribute("selected"), "selected");
      nodeOf(editor, "1").focus();
      nodeOf(editor, "1").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, composed: true, cancelable: true }));
      await until(() => line() !== before, "the relation follows the step of the keyboard");
      nodeOf(editor, "1").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true, cancelable: true }));
      await until(() => editor.diagram.node("1").pos_x > x, "moved");
    });

    it("a right click or a long press on a relation opens its dialog, also in relation mode of other types", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const relation = editor.diagram.relations()[0];
      const path = editor.shadowRoot.querySelector(`ww-path[data-ww-key="${relation.id}"]`);
      const at = path.getBoundingClientRect();
      const event = new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, clientX: at.left + at.width / 2, clientY: at.top + at.height / 2 });
      path.dispatchEvent(event);
      assert.isTrue(event.defaultPrevented, "the browser's menu is kept away");
      await until(() => editor.relationEditDialog._dialogData?.id === relation.id, "relation dialog");
    });

    it("a relation is made by picking two classes, and a self-relation by picking one twice", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const ids: string[] = editor.diagram.classes.map((n: any) => String(n.id));
      const pair = ids.flatMap((a) => ids.map((b) => [a, b])).find(([a, b]) => a !== b && editor.diagram.relationsBetween(a, b) === 0)!;
      const count = editor.diagram.relationCount;
      editor._addRelation("association");
      await editor.updateComplete;
      assert.isFalse(nodeOf(editor, pair[0]).hasAttribute("movable"), "classes cannot be moved in relation mode");
      await click(nodeOf(editor, pair[0]));
      await click(nodeOf(editor, pair[1]));
      await until(() => editor.diagram.relationCount === count + 1, "relation added");
      await until(() => editor.shadowRoot.querySelectorAll("ww-path[data-ww-key]").length === count + 1, "path drawn");
      const added = editor.diagram.relations().find((r: any) => r.from === pair[0] && r.to === pair[1]);
      assert.isTrue(added && editor.diagram.typeOf(added) === "association", "type stored");
      await until(() => Object.values<any>(stored(host)).some((n) => String(n.id) === pair[1] && Object.values<any>(n.inputs).some((i) => i.connections.some((c: any) => c.node === pair[0]))), "stored with the input side");
      assert.isTrue(nodeOf(editor, pair[0]).hasAttribute("movable"), "relation mode ended");

      editor._addRelation("association-undirected");
      await editor.updateComplete;
      await click(nodeOf(editor, pair[0]));
      await click(nodeOf(editor, pair[0]));
      await until(() => editor.diagram.relationCount === count + 2, "self-relation added");
      const loop = editor.diagram.relations().find((r: any) => r.self);
      assert.isTrue(loop && editor.diagram.node(loop.target).data.isProxy, "the loop ends at a proxy node");
      assert.equal(editor.shadowRoot.querySelectorAll("ww-node").length, ids.length, "the proxy node is not drawn");
      await until(() => editor.shadowRoot.querySelector(`ww-path[data-ww-key="${loop.id}"]`), "loop drawn");
      const points = editor.shadowRoot.querySelector("ww-scene").drawingOf(editor.shadowRoot.querySelector(`ww-path[data-ww-key="${loop.id}"]`)).points;
      assert.isTrue(points.length >= 4 && Math.min(...points.map((p: any) => p.x)) < editor.diagram.node(pair[0]).pos_x - 20, "the loop leaves the class to the left");
    });

    it("selecting and Delete removes a class with its relations and proxies", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      editor._addRelation("association");
      await editor.updateComplete;
      await click(nodeOf(editor, "1"));
      await click(nodeOf(editor, "1"));
      await until(() => editor.diagram.relations().some((r: any) => r.self), "self-relation");
      const classes = editor.diagram.classCount;
      await click(nodeOf(editor, "1"));
      await until(() => nodeOf(editor, "1").hasAttribute("selected"), "selected");
      nodeOf(editor, "1").dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }));
      await until(() => editor.diagram.classCount === classes - 1, "class removed");
      assert.isTrue(editor.diagram.stored.every((n: any) => !n.data.isProxy), "its proxy is gone");
      assert.isTrue(editor.diagram.relations().every((r: any) => r.from !== "1" && r.to !== "1"), "its relations are gone");
      await until(() => !stored(host)[1] && !Object.values<any>(stored(host)).some((n) => n.data.isProxy), "stored without it");
    });

    it("a double click opens the dialog of a class or of a relation", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      await click(nodeOf(editor, "1"));
      await click(nodeOf(editor, "1"));
      await until(() => editor.classEditDialog._selectedNodeId === "1", "class dialog");
      const relation = editor.diagram.relations()[0];
      editor.shadowRoot.querySelector(`ww-path[data-ww-key="${relation.id}"]`).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true }));
      await until(() => editor.relationEditDialog._dialogData?.id === relation.id, "relation dialog");
    });

    it("the stored diagram is replaced from outside and a class can be removed from the model", async function () {
      const host = await mount(mode);
      const editor = await ready(host);
      const data = JSON.parse(host.classDiagramData);
      delete data.drawflow.Home.data["2"];
      host.classDiagramData = JSON.stringify(data);
      await until(() => !nodeOf(editor, "2") && editor.diagram.classCount === Object.keys(data.drawflow.Home.data).length, "outside change shown");
      assert.isTrue(editor.diagram.relations().every((r: any) => r.source !== "2"), "no dangling relations drawn");
    });
  });
}

mocha.run();
