// Datatype for storing the settings for sequence diagrams
export class SequenceSettings {
    
    // ======================================================================
    // Constraints and Exist-Settings
    // ======================================================================

    /** Max number of lifelines allowed in the diagram */
    maxNumberOfLifelines: number;

    /** Max number of messages allowed in the diagram */
    maxNumberOfMessages: number;

    /** Max number of fragments allowed in the diagram */
    maxNumberOfFragments: number;

    /** Max number of activations allowed in the diagram */
    maxNumberOfActivations: number;

    /** Do the following types of messages exist/are they allowed in the diagram */
    synchronousMessageExists: boolean;
    asynchronousMessageExists: boolean;
    replyMessageExists: boolean;
    createMessageExists: boolean;
    destroyMessageExists: boolean;
    foundMessageExists: boolean;
    lostMessageExists: boolean;

    /** Do the following types of fragments exist/are they allowewd in the diagram */
    optionalFragmentExists: boolean;
    loopFragmentExists: boolean;
    alternativeFragmentExists: boolean;

    /** Do the activation bar is allowed in the diagram */
    activationExists: boolean;

    /** Activate/Deactivate the set of icons for the Object Box */
    iconsInObjectBoxExists: boolean;

    // ======================================================================
    // Validation
    // ======================================================================

    /** Check for empty object name */
    checkForEmptyObjectNames: boolean;

    /** Check for empty class name */
    checkForEmptyClassNames: boolean;

    /** The condition for fragments should noch be empty */
    checkForEmptyGuards: boolean;

    /** The first letter of a meesage normaly is a method and should start with a small letter*/
    checkForFirstLetterOfMessages: boolean;

    /** The first letter of a class should be a big letter*/
    checkForFirstLetterOfClass: boolean;

    /** The first letter of an object should be a small letter */
    checkForFirstLetterOfObject: boolean;

    /** Check for overlapping fragments */
    checkForFragmentOverlap: boolean;

    // ======================================================================
    // Getter for init Settings
    // ======================================================================

    /** returns a new object with the standard values */
    public static getInitialSequenceSettings(): SequenceSettings {
        const sequenceSettings = new SequenceSettings();

        sequenceSettings.synchronousMessageExists = true;
        sequenceSettings.asynchronousMessageExists = true;
        sequenceSettings.replyMessageExists = true;
        sequenceSettings.createMessageExists = true;
        sequenceSettings.destroyMessageExists = true;
        sequenceSettings.foundMessageExists = true;
        sequenceSettings.lostMessageExists = true;

        sequenceSettings.optionalFragmentExists = true;
        sequenceSettings.loopFragmentExists = true;
        sequenceSettings.alternativeFragmentExists = true;

        sequenceSettings.activationExists = true;

        sequenceSettings.iconsInObjectBoxExists = true;
        
        sequenceSettings.maxNumberOfLifelines = 10;
        sequenceSettings.maxNumberOfMessages = 50;
        sequenceSettings.maxNumberOfFragments = 10;
        sequenceSettings.maxNumberOfActivations = 20;

        sequenceSettings.checkForEmptyGuards = true;
        sequenceSettings.checkForEmptyClassNames = false;
        sequenceSettings.checkForEmptyObjectNames = true;
        sequenceSettings.checkForFirstLetterOfClass = true;
        sequenceSettings.checkForFirstLetterOfMessages = true;
        sequenceSettings.checkForFirstLetterOfObject = true;
        sequenceSettings.checkForFragmentOverlap = true;
        
        return sequenceSettings;
    }
}