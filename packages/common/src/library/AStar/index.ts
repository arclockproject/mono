import LibArray from "@arclockproject/common/library/Array";

/**
 * A 2D point or offset on the grid. `x` is the column and `y` is the row.
 */
class Vector2D {
  constructor(
    public x: number,
    public y: number,
  ) {}
  /**
   * @returns Straight-line distance to `other`.
   */
  distance(other: Vector2D): number {
    return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
  }
  /**
   * @returns A new vector with the same `x` and `y`.
   */
  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }
  /**
   * Adds `vector` to this vector in place. Use `copy()` first to keep the original.
   *
   * @returns This vector, for chaining.
   * @example
   * new Vector2D(1, 1).add(new Vector2D(2, 0)); // Vector(x=3,y=1)
   */
  add(vector: Vector2D): this {
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }
  toString() {
    return `Vector(x=${this.x},y=${this.y})`;
  }
}
/**
 * One cell of a `Map2D`. Extend it to store your own data per cell, and pass
 * the subclass as `Map2D`'s type parameter.
 */
class Node2D {
  /** The node before this one on the last calculated path. Set by `Map2D.calculatePath`. */
  public cameFrom: this | null = null;
  /** Path cost from the start. Set by `Map2D.calculatePath`. */
  public g: number = Infinity;
  /** Search score. Set by `Map2D.calculatePath`. */
  public f: number = Infinity;
  /** The map this node belongs to. Set by the `Map2D` constructor. */
  public mapRef: Map2D<this> | null = null;
  /**
   * @param pos Position on the map. Must match the node's place in the matrix.
   * @param cost How expensive it is to step onto this node. Paths prefer lower costs.
   * @param traversable `false` makes this node a wall.
   */
  constructor(
    public pos: Vector2D,
    public cost: number,
    public traversable: boolean = true,
  ) {}
  /**
   * @returns Straight-line distance to `other`.
   */
  distance(other: this): number {
    return this.pos.distance(other.pos);
  }
  /**
   * @returns The nodes up, down, left and right of this one that exist and are traversable.
   */
  getTraversableNeighbors(): this[] {
    return [
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(-1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, -1))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, 1))),
    ].filter((e): e is this => !!e && e.traversable);
  }
  /**
   * @returns The nodes up, down, left and right of this one that exist, including walls.
   */
  getNeighbors(): this[] {
    return [
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(-1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, -1))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, 1))),
    ].filter((e): e is this => !!e);
  }
  /**
   * Follows `cameFrom` back from this node until it reaches `end`. Used by
   * `Map2D.calculatePath`. Logs an error and returns what it has if the chain breaks.
   *
   * @returns Nodes from this node to `end`, both included.
   */
  traversePathTill(end: this): this[] {
    const path: this[] = [];
    let current: this = this;
    while (current !== end) {
      path.push(current);
      if (!current.cameFrom) {
        console.error("Error: current.cameFrom is null");
        return path;
      }
      current = current.cameFrom;
    }
    path.push(current);
    return path;
  }
  toString() {
    return `Node2D(pos=${this.pos.toString()},cost=${this.cost},traversable=${this.traversable})`;
  }
}
/**
 * A grid of `Node2D`s that can find paths between them. Movement is up, down,
 * left and right only.
 *
 * @see {@link https://arclockproject.org/docs/common/library/AStar Guide} | {@link https://arclockproject.org/docs/api/common/library/AStar API}
 * @example
 * const map = new Map2D(
 *   Map2D.generateNodeMatrix((pos) => new Node2D(pos, 1), 10),
 * );
 * map.getNode({ x: 5, y: 5 })!.traversable = false;
 * const path = map.calculatePath(
 *   map.getNode({ x: 0, y: 0 }),
 *   map.getNode({ x: 9, y: 9 })
 * );
 */
class Map2D<CustomNode2D extends Node2D = Node2D> {
  /**
   * @returns The node at `pos`, or `null` if it is outside the map.
   */
  getNode(pos: Vector2D): CustomNode2D | null;
  getNode(pos: { x: number; y: number }): CustomNode2D | null;
  getNode(pos: Vector2D | { x: number; y: number }): CustomNode2D | null {
    return this.nodes[pos.y]?.[pos.x] ?? null;
  }
  /**
   * Returns the rectangle of nodes between two corners, as rows. The rectangle
   * starts at the smaller `x` and `y` and stops before the larger ones, and is
   * clipped to the map.
   *
   * @param posA One corner.
   * @param posB The opposite corner.
   * @returns Rows of nodes, top to bottom.
   * @example
   * map.getNodeArea({ x: 0, y: 0 }, { x: 2, y: 2 }); // 2×2 nodes: (0,0) to (1,1)
   */
  getNodeArea(posA: Vector2D, posB: Vector2D): CustomNode2D[][];
  getNodeArea(
    posA: { x: number; y: number },
    posB: { x: number; y: number },
  ): CustomNode2D[][];
  getNodeArea(
    posA: Vector2D | { x: number; y: number },
    posB: Vector2D | { x: number; y: number },
  ): CustomNode2D[][] {
    const left = Math.max(Math.min(posA.x, posB.x), 0);
    const right = Math.min(Math.max(posA.x, posB.x), this.width);
    const top = Math.max(Math.min(posA.y, posB.y), 0);
    const bottom = Math.min(Math.max(posA.y, posB.y), this.height);

    return this.nodes.slice(top, bottom).map((row) => row.slice(left, right));
  }
  /**
   * Same as `getNodeArea`, but as one flat list, row by row.
   *
   * @param posA One corner.
   * @param posB The opposite corner.
   */
  getNodeAreaFlat(posA: Vector2D, posB: Vector2D): CustomNode2D[];
  getNodeAreaFlat(
    posA: { x: number; y: number },
    posB: { x: number; y: number },
  ): CustomNode2D[];
  getNodeAreaFlat(
    posA: Vector2D | { x: number; y: number },
    posB: Vector2D | { x: number; y: number },
  ): CustomNode2D[] {
    return this.getNodeArea(posA, posB).reduce((prev, nodes) => {
      prev.push(...nodes);
      return prev;
    }, []);
  }
  /**
   * Calls `forEach` for every node, row by row.
   */
  forEachNode(forEach: (node: CustomNode2D) => void): void {
    for (const row of this.nodes) {
      row.forEach(forEach);
    }
  }
  /**
   * Builds a node matrix to pass to the `Map2D` constructor, with each node at
   * the right position.
   *
   * @param generator Called once per cell with its position. Returns the node for that cell.
   * @param width Number of columns.
   * @param height Number of rows. Defaults to `width`.
   * @returns Rows of nodes, `[y][x]`.
   * @example
   * Map2D.generateNodeMatrix((pos) => new Node2D(pos, 1), 20, 10); // 20 wide, 10 tall
   */
  public static generateNodeMatrix<CustomNode2D extends Node2D = Node2D>(
    generator: (vector: Vector2D) => CustomNode2D,
    width: number,
    height?: number,
  ): CustomNode2D[][] {
    return new Array(height ?? width).fill(0).map((_valueY, y) =>
      Array(width)
        .fill(0)
        .map((_valueX, x) => generator(new Vector2D(x, y))),
    );
  }
  /** Number of columns. */
  public width = 0;
  /** Number of rows. */
  public height = 0;
  /**
   * @param nodes Rows of nodes, `[y][x]`. All rows should be the same length.
   * Each node's `mapRef` is set to this map.
   */
  constructor(public nodes: CustomNode2D[][]) {
    this.height = nodes.length;
    for (const row of nodes) {
      this.width = row.length;
      for (const node of row) {
        node.mapRef = this;
      }
    }
  }
  /**
   * Finds a path from `start` to `end` that avoids walls and prefers low-cost
   * nodes. Overwrites the `cameFrom`, `g` and `f` of the nodes it visits.
   *
   * @param start Node to start from. Usually from `getNode`.
   * @param end Node to reach.
   * @returns The path **from `end` back to `start`**, both included. `null` if
   * either node is `null` or no path exists.
   * @see https://en.wikipedia.org/wiki/A*_search_algorithm
   */
  calculatePath(
    start: CustomNode2D | null,
    end: CustomNode2D | null,
  ): CustomNode2D[] | null {
    if (!start || !end) return null;
    // The set of discovered nodes that may need to be (re-)expanded.
    // Initially, only the start node is known.
    // This is usually implemented as a min-heap or priority queue rather than a hash-set.
    const openSet = [start];

    // For node n, cameFrom[n] is the node immediately preceding it on the cheapest path from the start
    // to n currently known.
    // const cameFrom: {[Node2D]: number} = an empty map
    this.forEachNode((node) => {
      node.g = Infinity;
      node.f = Infinity;
    });
    // For node n, gScore[n] is the currently known cost of the cheapest path from start to n.
    // gScore := map with default value of Infinity
    // gScore[start] := 0
    start.g = 0;

    // For node n, fScore[n] := gScore[n] + h(n). fScore[n] represents our current best guess as to
    // how cheap a path could be from start to finish if it goes through n.
    // fScore := map with default value of Infinity

    // fScore[start] := h(start)
    start.f = start.cost;

    while (openSet.length > 0) {
      // This operation can occur in O(Log(N)) time if openSet is a min-heap or a priority queue
      // current := the node in openSet having the lowest fScore[] value
      const current = openSet.reduce(
        (prev, curr) => (prev.f < curr.f ? prev : curr),
        openSet[0]!,
      );

      if (current === end) {
        return current.traversePathTill(start); // reconstruct_path(cameFrom, current)
      }
      LibArray.remove(openSet, current);
      const neighbors = current.getTraversableNeighbors();
      for (const neighbor of neighbors) {
        // d(current,neighbor) is the weight of the edge from current to neighbor
        // tentative_gScore is the distance from start to the neighbor through current
        const tentative_gScore =
          current.g + current.distance(end) * neighbor.cost;
        if (tentative_gScore < neighbor.g) {
          // This path to neighbor is better than any previous one. Record it!
          neighbor.cameFrom = current;
          neighbor.g = tentative_gScore;
          neighbor.f = tentative_gScore;
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    // Open set is empty but goal was never reached
    return null;
  }
}

export { Map2D, Node2D, Vector2D };
