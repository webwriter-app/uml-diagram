/**
 * This Datatype defines additional global settings that apply for the whole 
 * widget (not only for single diagram types)
 */
export class GlobalSettings {
    
    // ======================================================================
    // General Widget Settings
    // ======================================================================

    /** activate/deactivate the class diagram */
    classDiagramEnabled: boolean;

    /** activate/deactivate the object diagram */
    objectDiagramEnabled: boolean;

    /** activate/deactivate the sequence diagram */
    sequenceDiagramEnabled: boolean;

    /** acitivate/deactivate a predefined checkpoint given by the author to return to for students */
    useCheckpoint: boolean;

    /** 
     * Global validation mode applied across all diagrams:
     * 'all' = all validation rules are active regardless of individual settings
     * 'off' = no validation rules are active regardless of individual settings
     * 'custom' = only the rules enabled in the individual diagram settings are applied
     */
    validationMode: 'all' | 'off' | 'custom';

    // ======================================================================
    // Getter for init Settings
    // ======================================================================

    /** returns a new object with the standard values */
    public static getInitialGlobalSettings(): GlobalSettings {
        const globalSettings = new GlobalSettings();
        
        globalSettings.classDiagramEnabled = true;
        globalSettings.objectDiagramEnabled = true;
        globalSettings.sequenceDiagramEnabled = true;
        globalSettings.useCheckpoint = true;
        globalSettings.validationMode = 'off';
        
        return globalSettings;
    }
}