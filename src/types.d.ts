/** Event of a Shoelace form control: its target carries `value` and `checked`. */
type FieldEvent = Event & { target: HTMLInputElement };

declare module "@webwriter/build/test" {
  export function getMochaConfig(): Mocha.MochaOptions;
}
