/**
 * Data models for classes and objects in the UML Class/Object Diagram.
 * Defines the structure of classes, attributes, methods, and parameters.
 */

/** Interface to define how an attribute of a class/object is stored */
export interface ClassAttribute {
  visibility: 'public' | 'private' | 'protected' | 'package';
  name: string;
  type: string;
  isStatic: boolean;
  isFinal: boolean;
  isParam: boolean;
}

/** Interface to define how a method of a class/object is stored */
export interface ClassMethod {
  visibility: 'public' | 'private' | 'protected' | 'package';
  name: string;
  returnType: string;
  parameters: MethodParameter[];
  isStatic: boolean;
  isFinal: boolean;
}

/** Interface to define how a parameter of a method is stored */
export interface MethodParameter {
  name: string;
  type: string;
}

/** Data model of how classes and objects are stored */
export class ClassModel {
  type: 'standard' | 'abstract' | 'interface' | 'enum' | 'object' | 'param-class' | 'datatype' | 'record' | 'annotation';
  name: string;
  attributes: ClassAttribute[];
  methods: ClassMethod[];
  // only relevant for objects:
  objectName: string;
  // only relevant for enums:
  enumValues: string[];
  // only relevant for association classes:
  associatedConnectionId: string;
} 