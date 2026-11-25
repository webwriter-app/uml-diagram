import type { ClassModel } from "./class-model";
import type { ClassSettings } from "./class-settings-model";

/** Translates a source string of the widget's catalog */
type Msg = (source: string) => string;

/** Interface definition for single validation issues */
export interface ValidationIssue {
    target: string;                
    message: string;               
    settingKey: keyof ClassSettings; 
}

/** Interface to check if relation rules are broken */
export interface RelationConstraint {
    type: string;                   
    direction: 'source' | 'target'; 
    otherNodeType: string;          
}

/** Checks all validation rules of the class dialog (also those not active in the settings) */
export function getClassValidationIssues(
    d: ClassModel,
    existingNames: string[],
    constraints: RelationConstraint[],
    msg: Msg
): ValidationIssue[] {
    if (!d) return [];
    const issues: ValidationIssue[] = [];
    const isObject = d.type === 'object';

    // helper to check if a method name matches the class name (= constructor)
    const isConstructor = (methName: string) => methName.trim() === d.name.trim();
    
    // helper to check if a method name looks like a constructor (case-insensitive match)
    const looksLikeConstructor = (methName: string) => 
        methName.trim().toLowerCase() === d.name.trim().toLowerCase() && methName.trim() !== d.name.trim();

    // checkEmptyObjectNames
    if (isObject && (!d.objectName || d.objectName.trim() === '')) {
        issues.push({
            target: 'objectname',
            message: msg('Object name is required.'),
            settingKey: 'checkEmptyObjectNames'
        });
    }

    // checkEmptyClassNames
    if (!d.name || d.name.trim() === '') {
        issues.push({
            target: 'classname',
            message: msg('Class name is required.'),
            settingKey: 'checkEmptyClassNames'
        });
    }

    // checkUniqueNames (class name)
    if (d.name && d.name.trim() !== '' && existingNames.includes(d.name)) {
        issues.push({
            target: 'classname',
            message: msg('This name is already used by another class.'),
            settingKey: 'checkUniqueNames'
        });
    }

    // checkNamingConventions (object name)
    if (isObject && d.objectName && /^[A-Z]/.test(d.objectName.trim())) {
        issues.push({
            target: 'objectname',
            message: msg('Object names should start with a lowercase letter.'),
            settingKey: 'checkNamingConventions'
        });
    }

    // checkNamingConventions: check for space in object names
    if (isObject && d.objectName && /\s/.test(d.objectName.trim())) {
        issues.push({
            target: 'objectname',
            message: msg('Object names must not contain spaces.'),
            settingKey: 'checkNamingConventions'
        });
    }

    // checkNamingConventions (class name)
    if (d.name && /^[a-z]/.test(d.name.trim())) {
        issues.push({
            target: 'classname',
            message: msg('Class names should start with an uppercase letter.'),
            settingKey: 'checkNamingConventions'
        });
    }

    // checkNamingConventions: check for space in class name
    if (d.name && /\s/.test(d.name.trim())) {
        issues.push({
            target: 'classname',
            message: msg('Class names must not contain spaces.'),
            settingKey: 'checkNamingConventions'
        });
    }

    // Attributes
    d.attributes.forEach((attr, index) => {

        // checkEmptyAttrMethParamFields: empty name
        if (!attr.name || attr.name.trim() === '') {
            issues.push({
                target: `attr-${index}-name`,
                message: msg('Attribute name is required.'),
                settingKey: 'checkEmptyAttrMethParamFields'
            });
        }

        // checkEmptyAttrMethParamFields: empty type
        if (!attr.type || attr.type.trim() === '') {
            issues.push({
                target: `attr-${index}-type`,
                message: msg('Attribute type is required.'),
                settingKey: 'checkEmptyAttrMethParamFields'
            });
        }

        // checkUniqueNames: duplicate attribute name within the same class
        const duplicate = d.attributes.find((a, i) => i !== index && a.name === attr.name && attr.name.trim() !== '');
        if (duplicate) {
            issues.push({
                target: `attr-${index}-name`,
                message: msg('Duplicate attribute name.'),
                settingKey: 'checkUniqueNames'
            });
        }

        // checkNamingConventions: attribute name should start with lowercase
        if (attr.name && /^[A-Z]/.test(attr.name.trim())) {
            issues.push({
                target: `attr-${index}-name`,
                message: msg('Attribute names should start with a lowercase letter.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // checkNamingConventions: check for space in attribute name
        if (attr.name && /\s/.test(attr.name.trim())) {
            issues.push({
                target: `attr-${index}-name`,
                message: msg('Attribute names must not contain spaces.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // checkModifiers: visibility in interfaces and annotations must be public
        if ((d.type === 'interface' || d.type === 'annotation') && (attr.visibility === 'private' || attr.visibility === 'protected' || attr.visibility === 'package')) {
            issues.push({
                target: `attr-${index}-vis`,
                message: msg('Attributes in interfaces and annotations must be public.'),
                settingKey: 'checkModifiers'
            });
        }

        // checkModifiers: interface attributes must be static and final
        if (d.type === 'interface' && (!attr.isStatic || !attr.isFinal)) {
            issues.push({
                target: `attr-${index}-modifiers`,
                message: msg('Interface attributes must be static and final.'),
                settingKey: 'checkModifiers'
            });
        }

        // checkModifiers: isParam only valid in parameterized classes
        if (attr.isParam && d.type !== 'param-class') {
            issues.push({
                target: `attr-${index}-modifiers`,
                message: msg('Parameter attributes are only valid in parameterized classes.'),
                settingKey: 'checkModifiers'
            });
        }
    });

    // Methods
    d.methods.forEach((meth, index) => {
        const isConstr = isConstructor(meth.name);

        // checkEmptyAttrMethParamFields: empty method name
        if (!meth.name || meth.name.trim() === '') {
            issues.push({
                target: `meth-${index}-name`,
                message: msg('Method name is required.'),
                settingKey: 'checkEmptyAttrMethParamFields'
            });
        }

        // checkEmptyAttrMethParamFields: empty return type for non constructor
        if (!isConstr && (!meth.returnType || meth.returnType.trim() === '')) {
            issues.push({
                target: `meth-${index}-return`,
                message: msg('Return type is required.'),
                settingKey: 'checkEmptyAttrMethParamFields'
            });
        }

        // checkConstructorReturnType: constructor must not have a return type
        if (isConstr && meth.returnType && meth.returnType.trim() !== '') {
            issues.push({
                target: `meth-${index}-return`,
                message: msg('Constructors must not have a return type.'),
                settingKey: 'checkConstructorReturnType'
            });
        }

        // checkNoConstructorsInObjects: objects cannot have constructors
        if (isObject && isConstr) {
            issues.push({
                target: `meth-${index}-name`,
                message: msg('Objects do not have constructors.'),
                settingKey: 'checkNoConstructorsInObjects'
            });
        }

        // checkNamingConventions: method naming
        if (meth.name && meth.name.trim() !== '') {
            if (looksLikeConstructor(meth.name)) {
                // looks like a constructor but written with wrong capitalization
                issues.push({
                    target: `meth-${index}-name`,
                    message: msg('This looks like a constructor but does not match the class name capitalization.'),
                    settingKey: 'checkNamingConventions'
                });
            } else if (!isConstr && /^[A-Z]/.test(meth.name.trim())) {
                // regular method starting with uppercase
                issues.push({
                    target: `meth-${index}-name`,
                    message: msg('Method names should start with a lowercase letter.'),
                    settingKey: 'checkNamingConventions'
                });
            }
        }

        // checkNamingConventions: check for space in method names
        if (meth.name && /\s/.test(meth.name.trim())) {
            issues.push({
                target: `meth-${index}-name`,
                message: msg('Method names must not contain spaces.'),
                settingKey: 'checkNamingConventions'
            });
        }

        // checkModifiers: visibility in interfaces and annotations must be public
        if ((d.type === 'interface' || d.type === 'annotation') && (meth.visibility === 'private' || meth.visibility === 'protected' || meth.visibility === 'package')) {
            issues.push({
                target: `meth-${index}-vis`,
                message: msg('Methods in interfaces and annotations must be public.'),
                settingKey: 'checkModifiers'
            });
        }

        // checkModifiers: abstract methods cannot be final
        if (d.type === 'abstract' && meth.isFinal) {
            issues.push({
                target: `meth-${index}-modifiers`,
                message: msg('Abstract methods cannot be final.'),
                settingKey: 'checkModifiers'
            });
        }

        // checkModifiers: abstract methods cannot be static
        if (d.type === 'abstract' && meth.isStatic) {
            issues.push({
                target: `meth-${index}-modifiers`,
                message: msg('Abstract methods cannot be static.'),
                settingKey: 'checkModifiers'
            });
        }

        // checkModifiers: constructors cannot be static or final
        if (isConstr && (meth.isStatic || meth.isFinal)) {
            issues.push({
                target: `meth-${index}-modifiers`,
                message: msg('Constructors cannot be static or final.'),
                settingKey: 'checkModifiers'
            });
        }

        // Parameters
        meth.parameters.forEach((param, pIndex) => {

            // checkEmptyAttrMethParamFields: empty parameter name
            if (!param.name || param.name.trim() === '') {
                issues.push({
                    target: `meth-${index}-param-${pIndex}-name`,
                    message: msg('Parameter name is required.'),
                    settingKey: 'checkEmptyAttrMethParamFields'
                });
            }

            // checkEmptyAttrMethParamFields: empty parameter type
            if (!param.type || param.type.trim() === '') {
                issues.push({
                    target: `meth-${index}-param-${pIndex}-type`,
                    message: msg('Parameter type is required.'),
                    settingKey: 'checkEmptyAttrMethParamFields'
                });
            }

            // checkUniqueNames: duplicate parameter name within the same method
            const dupParam = meth.parameters.find((p, pi) => pi !== pIndex && p.name === param.name && param.name.trim() !== '');
            if (dupParam) {
                issues.push({
                    target: `meth-${index}-param-${pIndex}-name`,
                    message: msg('Duplicate parameter name.'),
                    settingKey: 'checkUniqueNames'
                });
            }

            // checkNamingConventions: parameter name should start with lowercase
            if (param.name && /^[A-Z]/.test(param.name.trim())) {
                issues.push({
                    target: `meth-${index}-param-${pIndex}-name`,
                    message: msg('Parameter names should start with a lowercase letter.'),
                    settingKey: 'checkNamingConventions'
                });
            }

            // checkNamingConventions: check for space in parameter name
            if (param.name && /\s/.test(param.name.trim())) {
                issues.push({
                    target: `meth-${index}-param-${pIndex}-name`,
                    message: msg('Parameter names must not contain spaces.'),
                    settingKey: 'checkNamingConventions'
                });
            }
        });
    });

    // checkClassConnections
    if (constraints && constraints.length > 0) {
        for (const c of constraints) {

            // inheritance rules
            if (c.type === 'inheritance') {
                if (c.direction === 'source') {
                    if (d.type === 'enum' || d.type === 'record') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot extend other classes."), settingKey: 'checkClassConnections' });
                    }
                    if (d.type === 'interface' && c.otherNodeType !== 'interface') {
                        issues.push({ target: 'classtype', message: msg("Selected class type can only extend other interfaces."), settingKey: 'checkClassConnections' });
                    }
                    if (d.type !== 'interface' && c.otherNodeType === 'interface') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot extend an interface. Use Realization instead."), settingKey: 'checkClassConnections' });
                    }
                    if (d.type === 'annotation') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot extend other classes."), settingKey: 'checkClassConnections' });
                    }
                }
                if (c.direction === 'target') {
                    if (d.type === 'interface' && c.otherNodeType !== 'interface') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot be extended by a class. Use Realization instead."), settingKey: 'checkClassConnections' });
                    }
                    if (d.type !== 'interface' && c.otherNodeType === 'interface') {
                        issues.push({ target: 'classtype', message: msg("Selected class type can only be extended by other interfaces."), settingKey: 'checkClassConnections' });
                    }
                    if (d.type === 'enum' || d.type === 'record') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot be a parent class."), settingKey: 'checkClassConnections' });
                    }
                    if (d.type === 'annotation') {
                        issues.push({ target: 'classtype', message: msg("Selected class type cannot be a parent class."), settingKey: 'checkClassConnections' });
                    }
                }
            }

            // realization rules
            if (c.type === 'realization') {
                if (c.direction === 'source' && (d.type === 'interface' || d.type === 'annotation')) {
                    issues.push({ target: 'classtype', message: msg("Selected class type cannot implement interfaces. Use Inheritance instead."), settingKey: 'checkClassConnections' });
                }
                if (c.direction === 'target' && d.type !== 'interface') {
                    issues.push({ target: 'classtype', message: msg("Selected class type cannot be a realization target. Only interfaces are valid targets."), settingKey: 'checkClassConnections' });
                }
            }

            // composition and aggregation rules
            if (c.type === 'composition' || c.type === 'aggregation') {
                const invalidSourceTypes = ['interface', 'enum', 'datatype', 'annotation'];
                const invalidTargetTypes = ['enum', 'datatype', 'annotation'];
                if (c.direction === 'source' && invalidSourceTypes.includes(d.type)) {
                    issues.push({
                        target: 'classtype',
                        message: msg("Selected class type cannot own compositions or aggregations."),
                        settingKey: 'checkClassConnections'
                    });
                }
                if (c.direction === 'target' && invalidTargetTypes.includes(d.type)) {
                    issues.push({
                        target: 'classtype',
                        message: msg("Selected class type cannot be part of a composition or aggregation."),
                        settingKey: 'checkClassConnections'
                    });
                }
            }

            // bidirectional association rules
            if (c.type === 'association-bidirectional') {
                if (d.type === 'datatype' || d.type === 'enum') {
                    issues.push({
                        target: 'classtype',
                        message: msg("Selected class type cannot participate in bidirectional associations."),
                        settingKey: 'checkClassConnections'
                    });
                }
            }

            // one directional association rules
            if (c.type === 'association' && c.direction === 'source') {
                if (d.type === 'datatype' || d.type === 'enum') {
                    issues.push({
                        target: 'classtype',
                        message: msg("Selected class type cannot be the source of an association."),
                        settingKey: 'checkClassConnections'
                    });
                }
            }

            // object rules (objects can only participate in associations, compositionsx aggregations and dependancys)
            if (d.type === 'object') {
                const invalidForObjects = ['inheritance', 'realization'];
                if (invalidForObjects.includes(c.type)) {
                    if (c.direction === 'source') {
                        issues.push({
                            target: 'classtype',
                            message: msg("Objects cannot be the source of inheritance or realization relations."),
                            settingKey: 'checkClassConnections'
                        });
                    }
                    if (c.direction === 'target') {
                        issues.push({
                            target: 'classtype',
                            message: msg("Objects cannot be the target of inheritance or realization relations."),
                            settingKey: 'checkClassConnections'
                        });
                    }
                }
            }
        }
    }

    return issues;
}
