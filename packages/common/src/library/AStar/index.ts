import LibArray from "@arclockproject/common/library/Array";

class Vector2D {
  constructor(
    public x: number,
    public y: number,
  ) {}
  distance(other: Vector2D): number {
    return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
  }
  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }
  add(vector: Vector2D): this {
    this.x += vector.x;
    this.y += vector.y;
    return this;
  }
  toString() {
    return `Vector(x=${this.x},y=${this.y})`;
  }
}
class Node2D {
  public cameFrom: this | null = null;
  public g: number = Infinity;
  public f: number = Infinity;
  public mapRef: Map2D<this> | null = null;
  constructor(
    public pos: Vector2D,
    public cost: number,
    public traversable: boolean = true,
  ) {}
  distance(other: this): number {
    return this.pos.distance(other.pos);
  }
  getTraversableNeighbors(): this[] {
    return [
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(-1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, -1))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, 1))),
    ].filter((e): e is this => !!e && e.traversable);
  }
  getNeighbors(): this[] {
    return [
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(-1, 0))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, -1))),
      this.mapRef?.getNode(this.pos.copy().add(new Vector2D(0, 1))),
    ].filter((e): e is this => !!e);
  }
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
class Map2D<CustomNode2D extends Node2D = Node2D> {
  getNode(pos: Vector2D): CustomNode2D | null;
  getNode(pos: { x: number; y: number }): CustomNode2D | null;
  getNode(pos: Vector2D | { x: number; y: number }): CustomNode2D | null {
    return this.nodes[pos.y]?.[pos.x] ?? null;
  }
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
  forEachNode(forEach: (node: CustomNode2D) => void): void {
    for (const row of this.nodes) {
      row.forEach(forEach);
    }
  }
  public static generateNodeMatrix<CustomNode2D extends Node2D = Node2D>(
    /**
     * Generator run per required Node2D
     */
    generator: (
      /**
       * Vector with the current location on the matrix
       */
      vector: Vector2D,
    ) => CustomNode2D,
    width: number,
    /**
     * If not provided, will use width instead.
     */
    height?: number,
  ): CustomNode2D[][] {
    return new Array(height ?? width).fill(0).map((_valueY, y) =>
      Array(width)
        .fill(0)
        .map((_valueX, x) => generator(new Vector2D(x, y))),
    );
  }
  public width = 0;
  public height = 0;
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
