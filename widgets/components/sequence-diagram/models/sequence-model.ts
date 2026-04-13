/**
 * data model for objects
 */
export interface Lifeline {
    id: string;    
    name: string;   
    className: string; 
    stereotype: string;
    icon: string;   
    y: number;   
    length: number; 
    activations: { id: string; y: number; length: number }[];
}

/**
 * data model for messages
 */
export interface SequenceMessage {
    id: string;      
    name: string;  
    assignment: string;
    sourceId: string; 
    targetId: string; 
    /** y-Achsen Koordinate */
    y: number;
    type: 'sync' | 'async' | 'reply' | 'create' | 'destroy' | 'found' | 'lost'; 
}

/** Data model for one region inside of a fragment (e.g. the if or else block in 'alt') */
export interface FragmentOperand {
    id: string;
    guard: string;   
    height: number;  
}

/** Data model for the fragments */
export interface Fragment {
    id: string;
    type: 'opt' | 'alt' | 'loop'; 
    startLifelineId: string;      
    endLifelineId: string;        
    y: number;        
    operands: FragmentOperand[]; 
}

/**
 * Main data-model for the sequence-diagram.
 * Holds the current state of the diagram and defines initial state
 */
export class SequenceModel {
    lifelines: Lifeline[] = [];
    messages: SequenceMessage[] = [];
    fragments: Fragment[] = [];

    /**
     * Clear the diagram (no objects and messages)
     */
    public static getEmptyModel(): SequenceModel {
        const model = new SequenceModel();
        model.lifelines = [];
        model.messages = [];
        model.fragments = [];
        return model;
    }

    /**
     * Initial state for the diagram with one empty object and no messages
     */
    public static getInitialModel(): SequenceModel {
        const model = new SequenceModel();
        
        model.lifelines = [
            { 
                id: `ll-${Date.now()}`,
                name: "object", 
                className: "",
                stereotype: "",
                icon: "",
                y: 40, 
                length: 400,
                activations: []
            }
        ];

        model.messages = [];

        return model;
    }
}