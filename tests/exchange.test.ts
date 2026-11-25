/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import fixtures from "./fixtures/plantuml.json";
import { block, cleanup, data, modes, mount, sequenceSnippet, until } from "./helpers";

mocha.setup(getMochaConfig());

const file = (text: string, name: string, type = "text/plain") => new File([text], name, { type });
const classes = (host: any) => Object.values<any>(JSON.parse(host.classDiagramData).drawflow.Home.data).filter(node => !node.data.isProxy);
const relations = (host: any) => {
  const nodes = JSON.parse(host.classDiagramData).drawflow.Home.data;
  return Object.values<any>(nodes).flatMap(node => Object.values<any>(node.outputs).flatMap(port => port.connections.map((c: any) => ({ from: node.data.name, to: nodes[c.node].data.name, ...c.data }))));
};
const apply = async (host: any, key: string, text: string, name = "x.puml") => (await host[key](file(text, name)))();

for (const mode of modes) {
  describe(`<webwriter-uml-diagram> conversions (${mode} mode)`, function () {
    this.timeout(30000);
    afterEach(cleanup);

    it("declares its conversions", async function () {
      const host = await mount(mode);
      const widget = host.constructor as any;
      assert.hasAllKeys(widget.convertFrom, ["pre", ".puml", ".json"]);
      assert.hasAllKeys(widget.convertTo, ["img", "pre", ".puml", "image/svg+xml", ".json"]);
      for (const method of [...Object.values<string>(widget.convertFrom), ...Object.values<string>(widget.convertTo)]) assert.isFunction(host[method], method);
    });

    it("exports the class diagram as PlantUML", async function () {
      const host = await mount(mode);
      const out = host.exportPlantUml();
      assert.equal(out.name, "uml-diagram.puml");
      const text = await out.text();
      assert.match(text, /^@startuml/);
      assert.match(text, /\nclass Library/);
      assert.match(text, /--\|>|\.\.\|>|--\*|--o|-->/, "a relation");
      assert.match(text, /@enduml\n$/);
    });

    it("exports the shown diagram only: the sequence diagram as PlantUML and SVG", async function () {
      const host = await mount(mode, { html: sequenceSnippet });
      const text = await host.exportPlantUml().text();
      assert.match(text, /participant|actor/);
      assert.match(text, /alt /);
      assert.match(text, /->/);
      const svg = await host.exportSvg().text();
      const document_ = new DOMParser().parseFromString(svg, "image/svg+xml");
      assert.isNull(document_.querySelector("parsererror"), "well-formed SVG");
      assert.include(document_.documentElement.textContent, "Terminal");
    });

    it("exports an SVG of the class diagram with every class", async function () {
      const host = await mount(mode);
      const out = host.exportSvg();
      assert.equal(out.type, "image/svg+xml");
      const parsed = new DOMParser().parseFromString(await out.text(), "image/svg+xml");
      assert.isNull(parsed.querySelector("parsererror"), "well-formed SVG");
      for (const node of classes(host)) assert.include(parsed.documentElement.textContent, node.data.name);
      assert.isAbove(parsed.querySelectorAll("path[marker-end]").length, 0, "relations with arrow heads");
    });

    it("no text of the exported SVG reaches outside its class box or lifeline head", async function () {
      const place = async (html?: string) => {
        const host = await mount(mode, html ? { html } : undefined);
        const holder = document.createElement("div");
        holder.innerHTML = await host.exportSvg().text();
        document.body.append(holder);
        return holder;
      };
      const inside = (text: SVGGraphicsElement, rect: SVGGraphicsElement) => {
        const [t, r] = [text.getBoundingClientRect(), rect.getBoundingClientRect()];
        return t.left >= r.left + 5 && t.right <= r.right - 5 && t.top >= r.top && t.bottom <= r.bottom;
      };
      const classes = await place();
      const boxes = [...classes.querySelectorAll("g")].filter((group: Element) => group.querySelector(":scope > rect"));
      assert.isAbove(boxes.length, 0, "class boxes");
      for (const group of boxes) for (const text of group.querySelectorAll(":scope > text")) assert.isTrue(inside(text as any, group.querySelector(":scope > rect") as any), `"${text.textContent}" is inside its class box`);
      classes.remove();
      const sequence = await place(sequenceSnippet);
      const heads = [...sequence.querySelectorAll("text[text-decoration=underline]")];
      assert.isAbove(heads.length, 0, "lifeline heads");
      for (const text of heads) {
        const rect = [...sequence.querySelectorAll("rect[stroke-width=\"1.5\"]")].find((candidate: Element) => inside(text as any, candidate as any));
        assert.isDefined(rect, `"${text.textContent}" is inside its lifeline head`);
      }
      sequence.remove();
    });

    it("an empty diagram exports nothing", async function () {
      const host = await mount(mode, { html: `<webwriter-uml-diagram diagram-type="object-diagram"></webwriter-uml-diagram>` });
      assert.isNull(host.exportPlantUml());
      assert.isNull(host.exportSvg());
      assert.isNull(host.toImage());
      assert.isNull(host.toPlantUmlText());
    });

    it("imports a PlantUML class diagram: types, members, multiplicities and relation kinds", async function () {
      const host = await mount(mode);
      const before = host.sequenceModelData;
      const run = await host.importPlantUml(file(fixtures.class, "shop.puml"));
      assert.notInclude(host.classDiagramData, "Payable", "nothing changes before the function runs");
      run();
      await until(() => host.classDiagramData.includes("Payable"), "class data");
      const byName = Object.fromEntries(classes(host).map(node => [node.data.name, node.data]));
      assert.deepEqual(Object.keys(byName).sort(), ["Customer", "Invoice", "Item", "Order", "Payable", "Status"]);
      assert.equal(byName.Payable.type, "interface");
      assert.equal(byName.Order.type, "abstract");
      assert.equal(byName.Customer.type, "param-class");
      assert.equal(byName.Customer.attributes.find((a: any) => a.isParam).name, "T");
      assert.equal(byName.Invoice.type, "record");
      assert.deepEqual(byName.Status.enumValues, ["OPEN", "PAID"]);
      const order = byName.Order;
      assert.deepEqual(order.attributes.map((a: any) => [a.name, a.type, a.visibility, a.isStatic]), [["id", "int", "private", false], ["count", "int", "public", true]]);
      assert.deepEqual([order.methods[0].name, order.methods[0].returnType, order.methods[0].visibility], ["total", "double", "public"]);
      assert.deepEqual(byName.Payable.methods[0].parameters, [{ name: "amount", type: "double" }]);
      assert.isTrue(byName.Customer.attributes.find((a: any) => a.name === "name").isFinal);
      const found = relations(host);
      const has = (from: string, to: string, connectionType: string) => found.find(r => r.from === from && r.to === to && r.connectionType === connectionType);
      assert.ok(has("Item", "Order", "composition"), "the diamond sits at the whole, so the whole is the target");
      assert.equal(has("Item", "Order", "composition").sourceMultiplicity, "0..*");
      assert.equal(has("Item", "Order", "composition").targetMultiplicity, "1");
      assert.equal(has("Item", "Order", "composition").relationName, "contains");
      assert.ok(has("Customer", "Order", "association"));
      assert.ok(has("Order", "Payable", "realization"));
      assert.ok(has("Invoice", "Order", "inheritance"));
      assert.ok(has("Order", "Status", "dependency"));
      assert.equal(host.diagramType, "class-diagram");
      assert.strictEqual(host.sequenceModelData, before, "other diagrams stay");
      await until(() => data(host).classDiagramData.drawflow.Home.data["1"], "written to the block");
      assert.equal(host.shadowRoot.querySelector('class-object-container[diagramtype="class-diagram"]').savedDiagramData, host.classDiagramData, "the editor shows it");
    });

    it("imports an object diagram and switches to it, enabling the tab", async function () {
      const host = await mount(mode);
      host.globalSettings = { ...host.globalSettings, objectDiagramEnabled: false };
      await host.updateComplete;
      await apply(host, "importPlantUml", fixtures.object);
      assert.equal(host.diagramType, "object-diagram");
      assert.isTrue(host.globalSettings.objectDiagramEnabled);
      const nodes = Object.values<any>(JSON.parse(host.objectDiagramData).drawflow.Home.data).filter(node => !node.data.isProxy);
      assert.deepEqual(nodes.map(node => [node.data.type, node.data.objectName, node.data.name]), [["object", "tom", "Member"], ["object", "loan1", "Loan"]]);
      assert.equal(nodes[0].data.attributes[0].name, "name");
      assert.equal(nodes[0].data.attributes[0].type, '"Tom"');
    });

    it("imports a PlantUML sequence diagram with fragments, activations and every message kind", async function () {
      const host = await mount(mode);
      await apply(host, "importPlantUml", fixtures.sequence);
      assert.equal(host.diagramType, "sequence-diagram");
      const model = host.sequenceModelData;
      assert.deepEqual(model.lifelines.map((l: any) => [l.name, l.className, l.icon]), [["tom", "Member", "user"], ["terminal", "Terminal", "none"], ["Copy", "", "none"]]);
      assert.deepEqual(model.messages.map((m: any) => [m.name, m.assignment, m.type]), [
        ["borrow(1043)", "", "sync"], ["isAvailable()", "ok", "sync"], ["yes", "", "reply"], ['"not available"', "", "reply"], ["log()", "", "async"], ["wake()", "", "found"], ["notify()", "", "lost"],
      ]);
      const ys = model.messages.map((m: any) => m.y);
      assert.deepEqual(ys, [...ys].sort((a, b) => a - b), "messages in order");
      assert.equal(model.fragments.length, 1);
      assert.equal(model.fragments[0].type, "alt");
      assert.deepEqual(model.fragments[0].operands.map((o: any) => o.guard), ["[available]", "[else]"]);
      assert.isTrue(model.fragments[0].operands.every((o: any) => o.height > 0));
      assert.equal(model.lifelines[1].activations.length, 1);
      await until(() => data(host).sequenceModelData.messages.length === 7, "written to the block");
    });

    it("rejects files that are not PlantUML or hold no diagram, and changes nothing", async function () {
      const host = await mount(mode);
      const before = host.classDiagramData;
      for (const [text, pattern] of [[fixtures.invalid, /not a PlantUML/], [fixtures.empty, /no diagram/]] as const) {
        let error: any;
        try { await host.importPlantUml(file(text, "bad.puml")); } catch (caught) { error = caught; }
        assert.match(error?.message ?? "", pattern);
      }
      assert.equal(host.classDiagramData, before);
    });

    it("round trip: export then import gives the same classes, members and relations", async function () {
      const host = await mount(mode);
      const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
      const names = (h: any) => classes(h).map(node => JSON.stringify(canonical({ ...node.data, associatedConnectionId: "" }))).sort();
      const edges = (h: any) => relations(h).map(r => JSON.stringify(canonical({ ...r, sourceRole: r.sourceRole ?? "", targetRole: r.targetRole ?? "" }))).sort();
      const [classesBefore, edgesBefore] = [names(host), edges(host)];
      assert.isAbove(edgesBefore.length, 2);
      await apply(host, "importPlantUml", await host.exportPlantUml().text());
      assert.deepEqual(names(host), classesBefore, "classes");
      assert.deepEqual(edges(host), edgesBefore, "relations");
    });

    it("round trip of the sequence diagram keeps lifelines, messages and fragments", async function () {
      const host = await mount(mode, { html: sequenceSnippet });
      const summary = (model: any) => ({
        lifelines: model.lifelines.map((l: any) => [l.name, l.className, l.icon === "user" ? "user" : "other", l.activations.length]),
        messages: [...model.messages].sort((a: any, b: any) => a.y - b.y).map((m: any) => [m.name, m.assignment, m.type]),
        fragments: model.fragments.map((f: any) => [f.type, f.operands.map((o: any) => o.guard)]),
      });
      const before = summary(host.sequenceModelData);
      await apply(host, "importPlantUml", await host.exportPlantUml().text());
      assert.deepEqual(summary(host.sequenceModelData), before, "sequence");
    });

    it("PlantUML text in a pre becomes the diagram; other text is declined", async function () {
      const host = await mount(mode);
      const pre = (text: string) => { const fragment = document.createDocumentFragment(); const element = document.createElement("pre"); element.textContent = text; fragment.append(element); return fragment; };
      assert.isFalse(host.loadPlantUmlText(pre("hello")));
      assert.isTrue(host.loadPlantUmlText(pre(fixtures.class)));
      assert.include(host.classDiagramData, "Payable");
    });

    it("converts to a pre with PlantUML and to an img with an SVG data URL", async function () {
      const host = await mount(mode);
      const pre = host.toPlantUmlText();
      assert.equal(pre.localName, "pre");
      assert.match(pre.textContent, /^@startuml/);
      const img = host.toImage();
      assert.equal(img.localName, "img");
      assert.match(img.getAttribute("src"), /^data:image\/svg\+xml/);
      assert.isNotEmpty(img.getAttribute("alt"));
      const svg = decodeURIComponent(img.getAttribute("src").split(",")[1]);
      assert.include(svg, "<svg");
      assert.isNull(img.parentNode, "detached");
    });

    it("JSON export and import round trip the whole content and keep unrelated keys", async function () {
      const host = await mount(mode);
      const out = host.exportJson();
      assert.equal(out.name, "uml-diagram.json");
      const content = JSON.parse(await out.text());
      assert.deepEqual(Object.keys(content).sort(), ["classDiagramData", "classSettings", "globalSettings", "objectDiagramData", "objectSettings", "sequenceModelData", "sequenceSettings"]);
      content.sequenceModelData.lifelines[0].name = "from-file";
      content.classDiagramData = JSON.parse(host.classDiagramData);
      const withExtra = { ...JSON.parse(block(host).textContent!), extra: { keep: 1 } };
      block(host).textContent = JSON.stringify(withExtra);
      await apply(host, "importJson", JSON.stringify(content), "x.json");
      assert.equal(host.sequenceModelData.lifelines[0].name, "from-file");
      await until(() => data(host).sequenceModelData.lifelines[0].name === "from-file", "written");
      assert.deepEqual(data(host).extra, { keep: 1 });
    });

    it("JSON import rejects malformed and foreign files and changes nothing", async function () {
      const host = await mount(mode);
      const before = JSON.stringify(host.sequenceModelData);
      for (const text of ["{", "[1]", '{"unrelated": 1}', '{"sequenceModelData": {"lifelines": 1}}']) {
        let error: any;
        try { await host.importJson(file(text, "x.json", "application/json")); } catch (caught) { error = caught; }
        assert.ok(error, text);
      }
      assert.equal(JSON.stringify(host.sequenceModelData), before);
    });
  });
}

mocha.run();
