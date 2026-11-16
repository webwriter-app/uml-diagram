# Uml Diagram (`@webwriter/uml-diagram@2.0.0`)
[License: MIT](LICENSE) | Version: 2.0.0

Create and practice UML class, object and sequence diagrams with configurable elements, limits and validation.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Library Loan | `@webwriter/uml-diagram/snippets/library-loan.html` |
| Online Shop Checkout | `@webwriter/uml-diagram/snippets/online-shop-checkout.html` |



## `WebwriterUmlDiagram` (`<webwriter-uml-diagram>`)
Interactive editor for UML class, object and sequence diagrams.
Authors configure the available diagram types, elements, limits and validation rules and can provide a
starting diagram that learners can reset to. Learners model their solution directly in the widget.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/uml-diagram/widgets/webwriter-uml-diagram.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/uml-diagram/widgets/webwriter-uml-diagram.js"></script>
<webwriter-uml-diagram></webwriter-uml-diagram>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/uml-diagram
```

```html
<link href="@webwriter/uml-diagram/widgets/webwriter-uml-diagram.css" rel="stylesheet">
<script type="module" src="@webwriter/uml-diagram/widgets/webwriter-uml-diagram.js"></script>
<webwriter-uml-diagram></webwriter-uml-diagram>
```

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `WebwriterUmlDiagram.options` | `object` | - | `{ diagramType: { type: "select" as const, label: (widget: {msg: MsgFn}) => widget.msg("Diagram to show"), options: [ { value: "class-diagram", label: (widget: {msg: MsgFn}) => widget.msg("Class diagram") }, { value: "object-diagram", label: (widget: {msg: MsgFn}) => widget.msg("Object diagram") }, { value: "sequence-diagram", label: (widget: {msg: MsgFn}) => widget.msg("Sequence diagram") }, ], }, }` | ✗ |
| `WebwriterUmlDiagram.actions` | `object` | - | `{ openSettings: { label: (widget: {msg: MsgFn}) => widget.msg("Configure diagrams"), icon: "Settings", intent: "default" as const }, }` | ✗ |
| `localize` | - | - | - | ✗ |
| `msg` | - | - | - | ✗ |
| `classSettings` | `ClassSettings` | Class diagram settings as JSON: available class and relation types, limits and validation rules | - | ✗ |
| `objectSettings` | `ClassSettings` | Object diagram settings as JSON: available elements, displayed details, limits and validation rules | - | ✗ |
| `sequenceSettings` | `SequenceSettings` | Sequence diagram settings as JSON: available messages, fragments and activations, limits and validation rules | - | ✗ |
| `globalSettings` | `GlobalSettings` | Global settings as JSON: enabled diagram types, checkpoint reset and validation mode | - | ✗ |
| `diagramType` (`diagram-type`) | `string` | Currently shown diagram: `class-diagram`, `object-diagram` or `sequence-diagram` | `"class-diagram"` | ✓ |
| `sequenceModelData` | `SequenceModel` | Sequence diagram content as JSON (lifelines, messages and fragments) | - | ✗ |
| `classDiagramData` | `string` | Class diagram content as JSON | `''` | ✗ |
| `objectDiagramData` | `string` | Object diagram content as JSON | `''` | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Methods
| Name | Description | Parameters |
| :--: | :---------: | :-------: |
| `openSettings` | - | -

*[Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions) allow programmatic access to the widget.*

## Slots
| Name | Description | Content Type |
| :--: | :---------: | :----------: |
| `data` | Direct application/json block stores diagram settings and authored models. | - |

*[Slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) define how the content of the widget is rendered.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.9.1*