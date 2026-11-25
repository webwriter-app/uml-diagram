/** Data model for storing the settings of the class and object diagram. */
export class ClassSettings {
    
    // ======================================================================
    // Existence of classes and relations
    // ======================================================================

    /** Exist Flags for class types */
    standardExists: boolean;
    abstractExists: boolean;
    interfaceExists: boolean;
    enumExists: boolean;
    objectExists: boolean;
    parameterizedExists: boolean;
    associationClassExists: boolean;
    recordExists: boolean;
    dataTypeExists: boolean;
    annotationExists: boolean;
    
    /** Exist Flags for relation types */
    associationExists: boolean;
    associationBidirectionalExists: boolean; 
    associationUndirectedExists: boolean;    
    inheritanceExists: boolean;
    compositionExists: boolean;
    aggregationExists: boolean;
    dependencyExists: boolean;
    realizationExists: boolean;

    // ----------------------------------------------------------------------
    // Optional Visibility Options
    // ----------------------------------------------------------------------

    protectedExists: boolean;
    packageExists: boolean;

    // ======================================================================
    // Object Diagram Specifics
    // ======================================================================
    
    /** Show methods inside the object node and the edit dialog */
    showMethodsInObjects: boolean;

    /** Show method parameters (only applies if showMethodsInObjects is true) */
    showParametersInObjects: boolean;

    /** Show modifiers like static, final, or parameterized */
    showModifiersInObjects: boolean;

    /** Show visibility (+, -, #, ~) in objects */
    showVisibilityInObjects: boolean;

    // ======================================================================
    // Constraints
    // ======================================================================

    /** Max number of classes in total */
    maxClasses: number;

    /** Max number of relation in total */
    maxRelations: number;

    /** Max number of relation between the same two classes */
    maxNumberRelationsBetweenTwoClasses: number;

    // ----------------------------------------------------------------------
    // Validation inside the Class and Object Edit dialog
    // ----------------------------------------------------------------------
    
    /** check for empty class names */
    checkEmptyClassNames: boolean;

    /** check for empty object names */
    checkEmptyObjectNames: boolean;

    /** check for empty fields in Attribute, Method an Parameter definitions (name and type) */
    checkEmptyAttrMethParamFields: boolean; 

    /** check for no return type for constructor */
    checkConstructorReturnType: boolean;

    /** check if class-, attribute- and methodnames are unique (attr and meth only in one class)*/
    checkUniqueNames: boolean;

    /** check for naming conventions (capitalization, no reserved word like e.g. void should be used) */
    checkNamingConventions: boolean;  

    /** check for valid modifiers (e.g. private in Interfaces or abstract+final) */
    checkModifiers: boolean;

    /** check for relation problems after change of class type */
    checkClassConnections: boolean;

    /** Check for constructors in objects */
    checkNoConstructorsInObjects: boolean;

    // ----------------------------------------------------------------------
    // Validation inside the relaiton editor dialog
    // ----------------------------------------------------------------------

    /** Check if dependancys start and end with << >> or « » */
    checkDependencyStereotypeSyntax: boolean; 

    /** Check Multiplicitys */
    checkRelationMultiplicitySyntax: boolean;

    // ----------------------------------------------------------------------
    // Are new relations allowed?
    // ----------------------------------------------------------------------


    /** check if relation is allowed (e.g. standard, interface combinations, inheritance cycles, ...) */
    checkRelationalLogic: boolean; 


    // ======================================================================
    // Getter for init Settings for class- and objectdiagram
    // ======================================================================

    /** returns a new object with the standard values */
    public static getInitialClassDiagramSettings(): ClassSettings {
        const classSettings = new ClassSettings();

        classSettings.standardExists = true;
        classSettings.abstractExists = true;
        classSettings.interfaceExists = true;
        classSettings.enumExists = true;
        classSettings.objectExists = false;
        classSettings.parameterizedExists = true;
        classSettings.associationClassExists = true;
        classSettings.recordExists = true;
        classSettings.dataTypeExists = true;
        classSettings.annotationExists = true;

        classSettings.associationExists = true;
        classSettings.associationBidirectionalExists = true; 
        classSettings.associationUndirectedExists = true;    
        classSettings.inheritanceExists = true;
        classSettings.compositionExists = true;
        classSettings.aggregationExists = true;
        classSettings.dependencyExists = true;
        classSettings.realizationExists = true;

        classSettings.protectedExists = true;
        classSettings.packageExists = true;

        classSettings.showMethodsInObjects = false;
        classSettings.showParametersInObjects = false;
        classSettings.showModifiersInObjects = false;
        classSettings.showVisibilityInObjects = true;

        classSettings.maxClasses = 20;
        classSettings.maxRelations = 20;
        classSettings.maxNumberRelationsBetweenTwoClasses = 3;

        classSettings.checkEmptyClassNames = true;
        classSettings.checkEmptyObjectNames = true;
        classSettings.checkEmptyAttrMethParamFields = true;
        classSettings.checkConstructorReturnType = true;
        classSettings.checkUniqueNames = true;
        classSettings.checkNamingConventions = true;   
        classSettings.checkModifiers = true;
        classSettings.checkClassConnections = true;
        classSettings.checkNoConstructorsInObjects = true;

        classSettings.checkDependencyStereotypeSyntax = true;
        classSettings.checkRelationMultiplicitySyntax = true;

        classSettings.checkRelationalLogic = true; 

        return classSettings;
    }

    /** returns a new object with the values for the object diagram */
    public static getInitialObjectDiagramSettings(): ClassSettings {
        const objectSettings = new ClassSettings();

        objectSettings.standardExists = false;
        objectSettings.abstractExists = false;
        objectSettings.interfaceExists = false;
        objectSettings.enumExists = false;
        objectSettings.objectExists = true;
        objectSettings.parameterizedExists = false;
        objectSettings.associationClassExists = false;
        objectSettings.recordExists = false;
        objectSettings.dataTypeExists = false;
        objectSettings.annotationExists = false;

        objectSettings.associationExists = true;
        objectSettings.associationBidirectionalExists = true; 
        objectSettings.associationUndirectedExists = true;    
        objectSettings.inheritanceExists = false;
        objectSettings.compositionExists = false;
        objectSettings.aggregationExists = false;
        objectSettings.dependencyExists = false;
        objectSettings.realizationExists = false;

        objectSettings.protectedExists = false;
        objectSettings.packageExists = false;

        objectSettings.showMethodsInObjects = false;
        objectSettings.showParametersInObjects = false;
        objectSettings.showModifiersInObjects = false;
        objectSettings.showVisibilityInObjects = false;

        objectSettings.maxClasses = 20;
        objectSettings.maxRelations = 20;
        objectSettings.maxNumberRelationsBetweenTwoClasses = 3;

        objectSettings.checkEmptyClassNames = false;
        objectSettings.checkEmptyObjectNames = true;
        objectSettings.checkEmptyAttrMethParamFields = true;
        objectSettings.checkConstructorReturnType = false;
        objectSettings.checkUniqueNames = true;
        objectSettings.checkNamingConventions = true;   
        objectSettings.checkModifiers = true;
        objectSettings.checkClassConnections = true;
        objectSettings.checkNoConstructorsInObjects = true;

        objectSettings.checkDependencyStereotypeSyntax = false;
        objectSettings.checkRelationMultiplicitySyntax = false;

        objectSettings.checkRelationalLogic = true;

        return objectSettings;
    }
}