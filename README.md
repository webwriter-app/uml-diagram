# UML Diagram (`@webwriter/uml-diagram@0.0.1`)
[License: MIT](LICENSE) | Version: 0.0.1

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
| `classSettings` (`class-settings`) | `ClassSettings` | Class diagram settings as JSON: available class and relation types, limits and validation rules | - | ✓ |
| `objectSettings` (`object-settings`) | `ClassSettings` | Object diagram settings as JSON: available elements, displayed details, limits and validation rules | - | ✓ |
| `sequenceSettings` (`sequence-settings`) | `SequenceSettings` | Sequence diagram settings as JSON: available messages, fragments and activations, limits and validation rules | - | ✓ |
| `globalSettings` (`global-settings`) | `GlobalSettings` | Global settings as JSON: enabled diagram types, checkpoint reset and validation mode | - | ✓ |
| `diagramType` (`diagram-type`) | `string` | Currently shown diagram: `class-diagram`, `object-diagram` or `sequence-diagram` | `"class-diagram"` | ✓ |
| `sequenceModelData` (`sequence-model-data`) | `SequenceModel` | Sequence diagram content as JSON (lifelines, messages and fragments) | - | ✓ |
| `classDiagramData` (`class-diagram-data`) | `string` | Class diagram content as JSON | `''` | ✓ |
| `objectDiagramData` (`object-diagram-data`) | `string` | Object diagram content as JSON | `''` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.9.1*