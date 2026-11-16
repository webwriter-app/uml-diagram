import type { ClassDiagram } from "./diagram";
import type { ClassSettings } from "./class-settings-model";

/** Translates a source string of the widget's catalog */
type Msg = (source: string) => string;

/** A rule a new relation breaks, with the setting that switches the rule on */
export interface RelationValidationIssue {
    message: string;
    settingKey: keyof ClassSettings;
}

/** Collects all rules a new relation of a type between two classes breaks (also those not active in the settings) */
export function relationIssues(diagram: ClassDiagram, mode: string, sourceId: string, targetId: string, msg: Msg): RelationValidationIssue[] {
    const issues: RelationValidationIssue[] = [];
    const source = diagram.node(sourceId);
    const target = diagram.node(targetId);
    if (!source || !target) return issues;
    const sType = source.data.type;
    const tType = target.data.type;
    const add = (message: string) => issues.push({ message, settingKey: 'checkRelationalLogic' });

    // self-relation checks for inheritance and realization
    if (sourceId === targetId) {
        if (mode === 'inheritance' || mode === 'realization') {
            add(mode === 'inheritance' ? msg("A class cannot inherit from itself.") : msg("A class cannot realize itself."));
        }
        return issues;
    }

    if (mode === 'inheritance') {
        if (sType === 'enum' || sType === 'record') add(msg("Enumerations and records cannot extend other classes."));
        if (sType === 'annotation') add(msg("Annotations cannot extend other classes."));
        if (tType === 'annotation') add(msg("Annotations cannot be extended."));
        if (sType === 'object' || tType === 'object') add(msg("Objects cannot participate in inheritance relations."));
        if (sType === 'interface' && tType !== 'interface') add(msg("Interfaces can only extend other interfaces."));
        if (sType !== 'interface' && tType === 'interface') add(msg("Classes cannot extend interfaces. Use realization to implement an interface."));
        if (diagram.hasRelation(sourceId, targetId, 'inheritance')) add(msg("This class already inherits from the selected class."));
    }

    if (mode === 'realization') {
        if (tType !== 'interface') add(msg("Only interfaces can be realization targets."));
        if (sType === 'interface') add(msg("Interfaces cannot realize other elements. Use inheritance to extend an interface."));
        if (sType === 'annotation') add(msg("Annotations cannot implement interfaces."));
        if (sType === 'object' || tType === 'object') add(msg("Objects cannot participate in realization relations."));
    }

    if ((mode === 'inheritance' || mode === 'realization') && diagram.reaches(targetId, sourceId, ['inheritance', 'realization'])) {
        add(msg("Inheritance cycles are not allowed."));
    }

    if (mode === 'composition' || mode === 'aggregation') {
        if (['interface', 'enum', 'datatype', 'annotation'].includes(sType)) add(msg("Selected class type cannot own compositions or aggregations."));
        if (['enum', 'datatype', 'annotation'].includes(tType)) add(msg("Selected class type cannot be part of a composition or aggregation."));
    }

    if (mode === 'composition') {
        if (diagram.hasCompositionOwner(targetId)) add(msg("This class is already part of a composition. A class can only have one owner."));
        if (diagram.reaches(targetId, sourceId, ['composition'])) add(msg("A class cannot directly or indirectly own itself."));
    }

    if (mode === 'association-bidirectional') {
        if (sType === 'datatype' || sType === 'enum') add(msg("Data types and enumerations cannot be the source of a bidirectional association."));
        if (tType === 'datatype' || tType === 'enum') add(msg("Data types and enumerations cannot be the target of a bidirectional association."));
    }

    if (mode === 'association' && (sType === 'datatype' || sType === 'enum')) {
        add(msg("Data types and enumerations cannot be the source of an association."));
    }

    return issues;
}
