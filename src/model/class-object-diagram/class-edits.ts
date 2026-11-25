import type { ClassAttribute, ClassMethod, ClassModel } from "./class-model";

/** Pure edits of a class model: each returns a new model and leaves the argument untouched */

export function addAttribute(d: ClassModel): ClassModel {
    const attribute: ClassAttribute = {
        visibility: 'public',
        name: '',
        type: '',
        isStatic: false,
        isFinal: false,
        isParam: false
    };
    return { ...d, attributes: [...d.attributes, attribute] };
}

export function updateAttribute(d: ClassModel, index: number, field: keyof ClassAttribute, value: string | boolean): ClassModel {
    const attributes = [...d.attributes];
    attributes[index] = { ...attributes[index], [field]: value } as ClassAttribute;
    return { ...d, attributes };
}

export function removeAttribute(d: ClassModel, index: number): ClassModel {
    const attributes = [...d.attributes];
    attributes.splice(index, 1);
    return { ...d, attributes };
}

export function addMethod(d: ClassModel): ClassModel {
    const method: ClassMethod = {
        visibility: 'public',
        name: '',
        returnType: '',
        parameters: [],
        isStatic: false,
        isFinal: false
    };
    return { ...d, methods: [...d.methods, method] };
}

export function updateMethod(d: ClassModel, index: number, field: keyof ClassMethod, value: string | boolean): ClassModel {
    const methods = [...d.methods];
    methods[index] = { ...methods[index], [field]: value } as ClassMethod;
    return { ...d, methods };
}

export function removeMethod(d: ClassModel, index: number): ClassModel {
    const methods = [...d.methods];
    methods.splice(index, 1);
    return { ...d, methods };
}

export function addParameter(d: ClassModel, methodIndex: number): ClassModel {
    const methods = [...d.methods];
    const method = { ...methods[methodIndex] };
    method.parameters = [...method.parameters, { name: '', type: '' }];
    methods[methodIndex] = method;
    return { ...d, methods };
}

export function updateParameter(d: ClassModel, methodIndex: number, paramIndex: number, field: 'name' | 'type', value: string): ClassModel {
    const methods = [...d.methods];
    const method = { ...methods[methodIndex] };
    const parameters = [...method.parameters];
    parameters[paramIndex] = { ...parameters[paramIndex], [field]: value };
    method.parameters = parameters;
    methods[methodIndex] = method;
    return { ...d, methods };
}

export function removeParameter(d: ClassModel, methodIndex: number, paramIndex: number): ClassModel {
    const methods = [...d.methods];
    const method = { ...methods[methodIndex] };
    const parameters = [...method.parameters];
    parameters.splice(paramIndex, 1);
    method.parameters = parameters;
    methods[methodIndex] = method;
    return { ...d, methods };
}

export function addEnumValue(d: ClassModel): ClassModel {
    return { ...d, enumValues: [...(d.enumValues || []), ""] };
}

export function updateEnumValue(d: ClassModel, index: number, value: string): ClassModel {
    const enumValues = [...d.enumValues];
    enumValues[index] = value;
    return { ...d, enumValues };
}

export function removeEnumValue(d: ClassModel, index: number): ClassModel {
    const enumValues = [...d.enumValues];
    enumValues.splice(index, 1);
    return { ...d, enumValues };
}
