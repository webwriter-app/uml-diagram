import { html, nothing } from "lit";
import { classMap } from "lit/directives/class-map.js";
import type { ClassModel } from "../../model/class-object-diagram/class-model";
import type { ClassSettings } from "../../model/class-object-diagram/class-settings-model";

const SYMBOLS: Record<string, string> = { public: '+', private: '-', package: '~' };
const STEREOTYPES = ['abstract', 'interface', 'enum', 'datatype', 'record', 'annotation'];

/** An empty section keeps a line of its own */
const EMPTY = " ";

/** The UML box of a class or object: header with name and stereotype, attributes and methods */
export function renderClassBox(data: ClassModel, settings: ClassSettings) {
    const isObject = data.type === 'object';
    const showVisibility = !isObject || settings.showVisibilityInObjects;
    const visibility = (v: string) => showVisibility ? `${SYMBOLS[v] ?? '#'} ` : '';
    // objects assign a value, classes declare a type
    const separator = isObject ? ' = ' : ': ';
    const showMethods = (!isObject || settings.showMethodsInObjects) && data.type !== 'annotation';

    const name = isObject
        ? `${data.objectName || ''}${data.name ? ` : ${data.name}` : ''}`
        : data.name;

    return html`
        <div class="uml-class-container">
            ${data.type === 'param-class' ? html`
                <div class="uml-template-box">
                    ${(data.attributes ?? []).filter(a => a.isParam).map(p => html`<div>${p.name}</div>`)}
                </div>` : nothing}
            <div class="uml-class-header">
                ${STEREOTYPES.includes(data.type) ? html`<div class="uml-stereotype">&lt;&lt;${data.type}&gt;&gt;</div>` : nothing}
                <div class=${classMap({ underlined: isObject, italic: data.type === 'abstract' })}>${name}</div>
            </div>
            ${data.type === 'enum' ? html`
                <div class="uml-class-section enumaration">
                    ${data.enumValues.map(value => html`<div><span>${value}</span></div>`)}
                </div>` : html`
                <div class="uml-class-section attributes">
                    ${data.attributes?.length ? data.attributes.map(a => html`<div>${visibility(a.visibility)}<span class=${classMap({ underlined: a.isStatic })}>${a.name}</span>${separator}${a.type}${a.isFinal ? ' {readOnly}' : ''}</div>`) : EMPTY}
                </div>
                ${showMethods ? html`
                    <div class="uml-class-section methods">
                        ${data.methods?.length ? data.methods.map(m => html`<div>${visibility(m.visibility)}<span class=${classMap({ underlined: m.isStatic })}>${m.name}</span>(${m.parameters?.map(p => `${p.name}: ${p.type}`).join(", ") ?? ''}): ${m.returnType}${m.isFinal ? ' {final}' : ''}</div>`) : EMPTY}
                    </div>` : nothing}`}
        </div>`;
}
