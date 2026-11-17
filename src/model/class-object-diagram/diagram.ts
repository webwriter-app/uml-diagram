import type { ClassModel } from "./class-model";
import type { RelationConstraint } from "./class-validation";

/** Data of the invisible node that is the other end of a self-relation */
export interface ProxyData {
    isProxy: true;
    parentNodeId: string;
}

/** What a class node stores: the class itself, or the proxy data */
export type NodeData = ClassModel & Partial<ProxyData>;

/** The data of one relation, stored on its connection in the output of the source class */
export interface RelationData {
    connectionType?: string;
    relationName?: string;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    sourceRole?: string;
    targetRole?: string;
}

interface StoredConnection {
    node: string;
    output?: string;
    input?: string;
    data?: RelationData;
}

interface StoredPort {
    connections: StoredConnection[];
}

/** A node as the document stores it (the format of the Drawflow export) */
export interface StoredNode {
    id: number;
    name: string;
    data: NodeData;
    class: string;
    html: string;
    typenode: boolean;
    inputs: Record<string, StoredPort>;
    outputs: Record<string, StoredPort>;
    pos_x: number;
    pos_y: number;
}

/** One relation, read from the connections of the diagram */
export interface Relation {
    /** `node_in_node-<target>_node_out_node-<source>_<output>_<input>`, which association classes store */
    id: string;
    /** The ids of the nodes the connection is stored between (the target of a self-relation is its proxy node) */
    source: string;
    target: string;
    outPort: string;
    inPort: string;
    /** The ids of the classes it is drawn between; the same for both ends of a self-relation */
    from: string;
    to: string;
    self: boolean;
    data: RelationData;
}

/** Types a relation constraint distinguishes; every other type counts as association */
const CONSTRAINT_TYPES = ['inheritance', 'realization', 'composition', 'aggregation'];

export function connectionId(source: string, target: string, outPort: string, inPort: string) {
    return `node_in_node-${target}_node_out_node-${source}_${outPort}_${inPort}`;
}

export const isProxy = (node: StoredNode) => !!node.data?.isProxy;

/**
 * The classes and objects of a diagram and the relations between them, in the format the document stores
 * (the export of Drawflow, which this diagram replaced). Nodes are looked up by their id as a string.
 */
export class ClassDiagram {
    #nodes = new Map<string, StoredNode>();
    #nextId = 1;

    /** The stored nodes, including proxy nodes */
    get stored(): StoredNode[] {
        return [...this.#nodes.values()];
    }

    /** The classes and objects (no proxy nodes) */
    get classes(): StoredNode[] {
        return this.stored.filter(node => !isProxy(node));
    }

    get classCount() {
        return this.classes.length;
    }

    get relationCount() {
        return this.relations().length;
    }

    node(id: string | number): StoredNode | undefined {
        return this.#nodes.get(String(id));
    }

    /** The diagram as the document stores it */
    export(): { drawflow: { Home: { data: Record<string, StoredNode> } } } {
        return { drawflow: { Home: { data: Object.fromEntries(this.#nodes) } } };
    }

    /** The data of the diagram as the JSON the widget keeps */
    serialize(): string {
        return JSON.stringify(this.export());
    }

    /** Replaces the diagram with stored data; an empty or invalid text clears it */
    load(json: string | null) {
        this.clear();
        if (!json) return;
        let data: Record<string, StoredNode> | undefined;
        try {
            data = JSON.parse(json)?.drawflow?.Home?.data;
        } catch {
            return;
        }
        for (const [key, node] of Object.entries(data ?? {})) {
            node.inputs ??= {};
            node.outputs ??= {};
            this.#nodes.set(String(node.id ?? key), node);
            this.#nextId = Math.max(this.#nextId, Number(node.id ?? key) + 1);
        }
    }

    clear() {
        this.#nodes.clear();
        this.#nextId = 1;
    }

    // ---------------------------------------------------------------------------------------------
    // Nodes
    // ---------------------------------------------------------------------------------------------

    addClass(data: ClassModel, x: number, y: number): StoredNode {
        return this.#add('class', 'uml-class', data, x, y, '');
    }

    #add(name: string, className: string, data: NodeData, x: number, y: number, html: string): StoredNode {
        const id = this.#nextId++;
        const node: StoredNode = { id, name, data, class: className, html, typenode: false, inputs: {}, outputs: {}, pos_x: x, pos_y: y };
        this.#nodes.set(String(id), node);
        return node;
    }

    moveNode(id: string, x: number, y: number) {
        const node = this.node(id);
        if (!node) return;
        node.pos_x = x;
        node.pos_y = y;
    }

    updateNodeData(id: string, data: ClassModel) {
        const node = this.node(id);
        if (node) node.data = data;
    }

    /** Removes a class with its relations, the association classes of those and the proxy nodes of its self-relations */
    removeNode(id: string) {
        const node = this.node(id);
        if (!node) return;
        for (const relation of this.relations()) {
            if (relation.source === id || relation.target === id) this.removeRelation(relation.id);
        }
        this.#nodes.delete(id);
    }

    /** A name for a new class that no other class has, by appending a number */
    uniqueClassName(baseName: string): string {
        const names = this.classes.map(node => node.data.name || '');
        let name = baseName;
        for (let counter = 1; names.includes(name); counter++) name = `${baseName}${counter}`;
        return name;
    }

    /** The names of the other classes, which a class must not take */
    otherClassNames(id: string): string[] {
        return this.classes.filter(node => String(node.id) !== id).map(node => node.data.name || '');
    }

    // ---------------------------------------------------------------------------------------------
    // Relations
    // ---------------------------------------------------------------------------------------------

    relations(): Relation[] {
        const relations: Relation[] = [];
        for (const node of this.#nodes.values()) {
            const source = String(node.id);
            for (const [outPort, port] of Object.entries(node.outputs)) {
                for (const connection of port.connections) {
                    const target = String(connection.node);
                    const targetNode = this.node(target);
                    if (!targetNode) continue;
                    const self = isProxy(targetNode) && String(targetNode.data.parentNodeId) === source;
                    const inPort = connection.output ?? '';
                    relations.push({
                        id: connectionId(source, target, outPort, inPort),
                        source, target, outPort, inPort,
                        from: source,
                        to: self ? source : target,
                        self,
                        data: connection.data ?? {}
                    });
                }
            }
        }
        return relations;
    }

    relation(id: string): Relation | undefined {
        return this.relations().find(relation => relation.id === id);
    }

    /** The type of a relation; classes without a stored type draw as a plain line */
    typeOf(relation: Relation): string | undefined {
        return relation.data.connectionType;
    }

    /** Adds a relation (a self-relation goes to an invisible proxy node) and returns its id */
    addRelation(sourceId: string, targetId: string, type: string): string | null {
        const source = this.node(sourceId);
        if (!source || !this.node(targetId)) return null;

        let target = targetId;
        if (sourceId === targetId) {
            const proxy = this.#add('proxy', 'uml-proxy-node', { isProxy: true, parentNodeId: sourceId } as NodeData,
                source.pos_x - 50, source.pos_y, '<div class="proxy-anchor"></div>');
            target = String(proxy.id);
        }
        const outPort = this.#port(sourceId, 'outputs');
        const inPort = this.#port(target, 'inputs');
        this.node(sourceId)!.outputs[outPort].connections.push({ node: target, output: inPort, data: { connectionType: type } });
        this.node(target)!.inputs[inPort].connections.push({ node: sourceId, input: outPort });
        return connectionId(sourceId, target, outPort, inPort);
    }

    /** An empty port of a node, or a new one */
    #port(nodeId: string, side: 'inputs' | 'outputs'): string {
        const ports = this.node(nodeId)![side];
        const empty = Object.keys(ports).find(key => ports[key].connections.length === 0);
        if (empty) return empty;
        const key = `${side === 'inputs' ? 'input' : 'output'}_${Object.keys(ports).length + 1}`;
        ports[key] = { connections: [] };
        return key;
    }

    updateRelationData(id: string, data: Omit<RelationData, 'connectionType'>) {
        const relation = this.relation(id);
        const connection = relation && this.node(relation.source)?.outputs[relation.outPort]
            .connections.find(c => String(c.node) === relation.target && c.output === relation.inPort);
        // the other data stays, e.g. the connection type
        if (connection) connection.data = { ...connection.data, ...data };
    }

    /** Removes a relation with its association class and, for a self-relation, its proxy node */
    removeRelation(id: string) {
        const relation = this.relation(id);
        if (!relation) return;

        const associationClass = this.stored.find(node => node.data?.associatedConnectionId === id);
        if (associationClass) this.removeNode(String(associationClass.id));

        const source = this.node(relation.source);
        const target = this.node(relation.target);
        if (!source || !target) return;
        const out = source.outputs[relation.outPort];
        out.connections = out.connections.filter(c => !(String(c.node) === relation.target && c.output === relation.inPort));
        const input = target.inputs[relation.inPort];
        if (input) input.connections = input.connections.filter(c => !(String(c.node) === relation.source && c.input === relation.outPort));
        if (isProxy(target)) this.#nodes.delete(relation.target);
    }

    /** Adds the association class of a relation, below a horizontal or right of a vertical middle point of the relation */
    addAssociationClass(relationId: string, centre: { x: number; y: number }, horizontal: boolean): StoredNode {
        const data: ClassModel = {
            type: 'standard',
            name: "NewAssociationClass",
            attributes: [],
            methods: [],
            objectName: '',
            enumValues: [],
            associatedConnectionId: relationId
        };
        return this.addClass(data, centre.x + (horizontal ? 0 : 100) - 60, centre.y + (horizontal ? 100 : 0) - 40);
    }

    // ---------------------------------------------------------------------------------------------
    // Queries for limits and validation
    // ---------------------------------------------------------------------------------------------

    /** The number of relations between two classes, in both directions; self-relations end at a proxy and count none */
    relationsBetween(a: string, b: string): number {
        return this.relations().filter(r =>
            (r.source === a && r.target === b) || (a !== b && r.source === b && r.target === a)).length;
    }

    /** Whether a relation of a type from one class to another exists */
    hasRelation(source: string, target: string, type: string): boolean {
        return this.relations().some(r => r.source === source && r.target === target && this.typeOf(r) === type);
    }

    /** Whether a class is the part of a composition */
    hasCompositionOwner(target: string): boolean {
        return this.relations().some(r => r.target === target && this.typeOf(r) === 'composition');
    }

    /** Whether the target already reaches the source along relations of these types (a new relation would close a cycle) */
    reaches(target: string, source: string, types: string[]): boolean {
        const relations = this.relations().filter(r => types.includes(this.typeOf(r) ?? ''));
        const visited = new Set([target]);
        const queue = [target];
        while (queue.length) {
            const current = queue.shift()!;
            if (current === source) return true;
            for (const r of relations) {
                if (r.source === current && !visited.has(r.target)) {
                    visited.add(r.target);
                    queue.push(r.target);
                }
            }
        }
        return false;
    }

    /** The relations of a class, as the dialog needs them to keep the class valid */
    constraintsOf(id: string): RelationConstraint[] {
        const kind = (relation: Relation) => {
            const type = this.typeOf(relation) ?? 'association';
            return CONSTRAINT_TYPES.includes(type) ? type : 'association';
        };
        return this.relations().flatMap((relation): RelationConstraint[] => {
            if (relation.source === id) {
                const other = this.node(relation.target);
                return other ? [{ type: kind(relation), direction: 'source', otherNodeType: other.data.type }] : [];
            }
            if (relation.target === id) {
                const other = this.node(relation.source);
                return other ? [{ type: kind(relation), direction: 'target', otherNodeType: other.data.type }] : [];
            }
            return [];
        });
    }
}
