/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import { block, cleanup, cls, data, modes, mount, seq, tabsText, until, wait } from "./helpers";

mocha.setup(getMochaConfig());

const same = (a: unknown, b: unknown, message: string) => assert.deepEqual(a, b, message);

for (const mode of modes) {
  describe(`<webwriter-uml-diagram> data and settings (${mode} mode)`, function () {
    this.timeout(30000);
    afterEach(cleanup);

    it("the data block is read into the widget", async function () {
      const host = await mount(mode);
      const stored = data(host);
      assert.isTrue(host.sequenceModelData.lifelines.length === stored.sequenceModelData.lifelines.length && host.sequenceModelData.lifelines.length > 0, "sequence model not read");
      assert.isTrue(typeof host.classDiagramData === "string" && host.classDiagramData.length > 10, "class data not read");
      same(JSON.parse(host.classDiagramData), stored.classDiagramData, "class data");
      assert.equal(host.shadowRoot.querySelector("sequence-diagram-container").model.lifelines.length, host.sequenceModelData.lifelines.length, "child model");
    });

    it("loading a class diagram updates toolbar counts without emitting a save", async function () {
      const host = await mount(mode);
      const before = host.classDiagramData;
      let saves = 0;
      host.addEventListener("diagram-data-changed", () => saves++);
      await wait(350);
      const container = cls(host);
      const editor = container.shadowRoot.querySelector("uml-editor");
      assert.equal(container.currentClassCount, editor.diagram.classCount);
      assert.equal(container.currentRelationCount, editor.diagram.relationCount);
      assert.equal(saves, 0, "loading is not an authored edit");
      assert.equal(host.classDiagramData, before);
    });

    it("a diagram change is written to the block, unrelated keys stay", async function () {
      const host = await mount(mode);
      const withExtra = { ...JSON.parse(block(host).textContent!), extra: { keep: 1 } };
      block(host).textContent = JSON.stringify(withExtra);
      await wait(100);
      const model = JSON.parse(JSON.stringify(host.sequenceModelData));
      model.lifelines[0].name = "changed-name";
      seq(host).dispatchEvent(new CustomEvent("sequence-model-changed", { detail: { model }, bubbles: true, composed: true }));
      await until(() => data(host).sequenceModelData.lifelines[0].name === "changed-name", "write");
      assert.equal(host.sequenceModelData.lifelines[0].name, "changed-name", "property");
      same(data(host).classDiagramData, JSON.parse(host.classDiagramData), "class data intact");
      same(data(host).extra, { keep: 1 }, "key the widget does not know");
      assert.ok(data(host).globalSettings, "global settings kept");
      assert.equal(host.querySelectorAll(":scope > script").length, 1, "exactly one block");
      assert.isTrue(block(host).getAttribute("type") === "application/json" && block(host).getAttribute("slot") === "data", "block attributes");
      assert.isFalse(block(host).textContent!.includes("<"), "no raw <");
    });

    it("several quick changes become one write after the pause", async function () {
      const host = await mount(mode);
      const container = seq(host);
      let writes = 0;
      const observer = new MutationObserver(() => writes++);
      observer.observe(block(host), { childList: true, characterData: true, subtree: true });
      for (const name of ["a1", "a2", "a3"]) {
        const model = JSON.parse(JSON.stringify(host.sequenceModelData));
        model.lifelines[0].name = name;
        container.dispatchEvent(new CustomEvent("sequence-model-changed", { detail: { model }, bubbles: true, composed: true }));
        await wait(30);
      }
      assert.notEqual(data(host).sequenceModelData.lifelines[0].name, "a3", "written before the pause");
      await until(() => data(host).sequenceModelData.lifelines[0].name === "a3", "final write");
      await wait(400);
      observer.disconnect();
      assert.isAtMost(writes, 2, `block changed ${writes} times`);
    });

    it("a change of the block from outside updates the widget", async function () {
      const host = await mount(mode);
      const next = JSON.parse(block(host).textContent!);
      next.sequenceModelData.lifelines[0].name = "remote";
      block(host).textContent = JSON.stringify(next);
      await until(() => host.sequenceModelData.lifelines[0].name === "remote", "remote read");
      await until(() => seq(host).model.lifelines[0].name === "remote", "child updated");
    });

    it("a widget without a block gets one, and a change goes into it", async function () {
      const host = await mount(mode, { html: `<webwriter-uml-diagram diagram-type="sequence-diagram"></webwriter-uml-diagram>` });
      await until(() => block(host), "block written for the defaults");
      const model = JSON.parse(JSON.stringify(host.sequenceModelData));
      model.lifelines.push({ id: "x", name: "x", className: "X", stereotype: "", icon: "none", y: 40, length: 200, activations: [] });
      seq(host).dispatchEvent(new CustomEvent("sequence-model-changed", { detail: { model }, bubbles: true, composed: true }));
      await until(() => data(host).sequenceModelData.lifelines.some((l: any) => l.id === "x"), "content written");
      assert.equal(block(host).getAttribute("slot"), "data", "slot");
    });

    it("reset goes to the checkpoint for learners only", async function () {
      const host = await mount(mode);
      host.globalSettings = { ...host.globalSettings, useCheckpoint: true };
      await host.updateComplete;
      const container = cls(host);
      await container.updateComplete;
      const editor = container.shadowRoot.querySelector("uml-editor");
      let asked: any;
      editor.confirm = async (options: any) => { asked = options; return false; };
      await container._handleClear();
      assert.ok(asked, "confirm was not asked");
      // Learners (read mode) return to the author's starting diagram; authors clear.
      assert.equal(/starting point/i.test(asked.message), mode === "read", "checkpoint");
      const sequence = seq(host);
      const sequenceEditor = sequence.shadowRoot.querySelector("sequence-editor");
      asked = undefined;
      sequenceEditor.confirm = async (options: any) => { asked = options; return false; };
      await sequence._handleClearDiagram();
      assert.ok(asked, "sequence confirm was not asked");
      assert.equal(/starting point/i.test(asked.message), mode === "read", "sequence checkpoint");
    });

    it("the language of the widget switches the texts, also in nested components", async function () {
      const host = await mount(mode, { lang: "de" });
      await until(() => /Klassendiagramm|Objektdiagramm|Sequenzdiagramm/i.test(tabsText(host)), "German tab labels");
      host.setAttribute("lang", "en");
      await until(() => /Class diagram|Object diagram|Sequence diagram/i.test(tabsText(host)), "English tab labels");
      host.setAttribute("lang", "fr");
      await until(() => !/Class diagram/i.test(tabsText(host)) && tabsText(host).length > 5, "French tab labels");
      host.removeAttribute("lang");
      await until(() => /Class diagram|Object diagram|Sequence diagram/i.test(tabsText(host)), "English again");
      assert.isFalse(host.hasAttribute("lang"), "lang attribute was written");
    });

    it("a language set on an ancestor is followed", async function () {
      const host = await mount(mode);
      const point = document.getElementById("mount")!;
      point.setAttribute("lang", "de");
      await until(() => /Klassendiagramm|Objektdiagramm|Sequenzdiagramm/i.test(tabsText(host)), "German from ancestor");
      point.removeAttribute("lang");
      await until(() => /Class diagram/i.test(tabsText(host)), "English again");
    });
  });
}

describe("<webwriter-uml-diagram> declarations", function () {
  afterEach(cleanup);
  it("the options and actions of the widget are declared", async function () {
    const host = await mount("edit");
    assert.equal(host.options?.diagramType?.type, "select", "option");
    assert.ok(host.actions?.openSettings, "action");
  });
});

mocha.run();
