import { Map2D, Node2D } from "@arclockproject/common/library/AStar";
import { AudioInstantManager } from "@arclockproject/common/library/AudioInstant";
import { useLocalStorageState } from "@arclockproject/common/library/LocalStorage";
import Random, { SeededRandom } from "@arclockproject/common/library/Random";
import { beepUrl } from "@site/src/components/DemoAssets";
import { useEffect, useMemo, useRef, useState } from "react";

const WIDTH = 25;
const HEIGHT = 17;
const MUD_COST = 5;
const GEM_COUNT = 5;
const STEP_MS = 70;
const START = { x: 1, y: 1 };

type Point = { x: number; y: number };
const key = (point: Point) => `${point.x},${point.y}`;

/**
 * Builds a maze from `seed`: a random depth-first maze with a few extra openings, so there is
 * more than one way around, then mud and gems on random floor cells. The same seed always
 * builds the same maze.
 */
function buildLevel(seed: string) {
  const rng = new SeededRandom(seed);
  const map = new Map2D(
    Map2D.generateNodeMatrix((pos) => new Node2D(pos, 1, false), WIDTH, HEIGHT),
  );
  const cell = (x: number, y: number) => map.getNode({ x, y });

  const stack: Point[] = [START];
  cell(START.x, START.y)!.traversable = true;
  while (stack.length > 0) {
    const { x, y } = stack[stack.length - 1]!;
    const next = [
      { x: x + 2, y },
      { x: x - 2, y },
      { x, y: y + 2 },
      { x, y: y - 2 },
    ].filter(
      (p) =>
        p.x > 0 &&
        p.y > 0 &&
        p.x < WIDTH - 1 &&
        p.y < HEIGHT - 1 &&
        !cell(p.x, p.y)!.traversable,
    );
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const pick = rng.fromArray(next);
    cell((x + pick.x) / 2, (y + pick.y) / 2)!.traversable = true;
    cell(pick.x, pick.y)!.traversable = true;
    stack.push(pick);
  }

  map.forEachNode((node) => {
    const { x, y } = node.pos;
    const inside = x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1;
    if (inside && !node.traversable && (x + y) % 2 === 1 && rng.random() < 0.12)
      node.traversable = true;
  });

  const floor: Node2D[] = [];
  map.forEachNode((node) => {
    if (node.traversable && key(node.pos) !== key(START)) floor.push(node);
  });
  for (const node of floor) if (rng.random() < 0.14) node.cost = MUD_COST;

  const gems = new Set<string>();
  while (gems.size < GEM_COUNT) gems.add(key(rng.fromArray(floor).pos));

  return { map, gems };
}

const isScores = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((v) => typeof v === "number")
    ? (value as Record<string, number>)
    : undefined;

export default function MazeApp() {
  const [seed, setSeed] = useState("arclockproject");
  const level = useMemo(() => buildLevel(seed), [seed]);
  const [pos, setPos] = useState<Point>(START);
  const [gems, setGems] = useState<Set<string>>(level.gems);
  const [spent, setSpent] = useState(0);
  const [queue, setQueue] = useState<Node2D[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const [best, setBest] = useLocalStorageState(
    "demo-maze-best",
    {} as Record<string, number>,
    isScores,
  );
  const audio = useRef<AudioInstantManager | null>(null);
  const done = gems.size === 0;

  useEffect(() => {
    setPos(START);
    setGems(new Set(level.gems));
    setSpent(0);
    setQueue([]);
  }, [level]);

  const play = (frequency: number) => {
    audio.current ??= new AudioInstantManager();
    audio.current.play(beepUrl(frequency));
  };

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => {
      const [node, ...rest] = queue;
      if (!node) return;
      const total = spent + node.cost;
      setPos(node.pos);
      setSpent(total);
      setQueue(rest);
      if (gems.has(key(node.pos))) {
        const left = new Set(gems);
        left.delete(key(node.pos));
        setGems(left);
        play(left.size === 0 ? 1047 : 880);
        if (
          left.size === 0 &&
          (best[seed] === undefined || total < best[seed]!)
        ) {
          setBest({ ...best, [seed]: total });
        }
      } else {
        play(node.cost > 1 ? 196 : 523);
      }
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  const walking = queue.length > 0;
  const preview = useMemo(() => {
    if (!hover || walking || done) return null;
    const path = level.map.calculatePath(
      level.map.getNode(pos),
      level.map.getNode(hover),
    );
    return path ? path.reverse().slice(1) : null;
  }, [hover, pos, walking, done, level]);
  const previewKeys = useMemo(
    () => new Set(preview?.map((node) => key(node.pos))),
    [preview],
  );
  const previewCost = preview?.reduce((sum, node) => sum + node.cost, 0) ?? 0;

  const walkTo = (target: Point) => {
    if (walking || done) return;
    const path = level.map.calculatePath(
      level.map.getNode(pos),
      level.map.getNode(target),
    );
    if (!path) return play(110);
    setQueue(path.reverse().slice(1));
  };

  const color = (node: Node2D) => {
    if (!node.traversable) return "var(--ifm-color-emphasis-800)";
    if (previewKeys.has(key(node.pos)))
      return "var(--ifm-color-primary-lighter)";
    if (node.cost > 1) return "#8d6e3f";
    return "var(--ifm-color-emphasis-100)";
  };

  return (
    <div className="container margin-bottom--xl">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label>
          Seed{" "}
          <input
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            style={{ width: 120 }}
          />
        </label>
        <button
          type="button"
          className="button button--sm button--secondary"
          onClick={() => setSeed(Random.rangeInt(0, 1000000000).toString(36))}
        >
          New maze
        </button>
        <button
          type="button"
          className="button button--sm button--secondary"
          onClick={() => {
            setPos(START);
            setGems(new Set(level.gems));
            setSpent(0);
            setQueue([]);
          }}
        >
          Restart
        </button>
        <span>
          💎 {GEM_COUNT - gems.size}/{GEM_COUNT} &middot; Energy used{" "}
          <strong>{spent}</strong>
          {best[seed] !== undefined && <> &middot; Best {best[seed]}</>}
          {preview && preview.length > 0 && (
            <> &middot; This route costs {previewCost}</>
          )}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div
          role="grid"
          onMouseLeave={() => setHover(null)}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${WIDTH}, minmax(14px, 28px))`,
            gap: 1,
            maxWidth: WIDTH * 29,
            userSelect: "none",
          }}
        >
          {level.map.nodes.flat().map((node) => {
            const id = key(node.pos);
            return (
              <button
                key={id}
                type="button"
                disabled={!node.traversable}
                aria-label={`Walk to ${node.pos.x}, ${node.pos.y}`}
                onMouseEnter={() => setHover(node.pos)}
                onFocus={() => setHover(node.pos)}
                onClick={() => walkTo(node.pos)}
                style={{
                  aspectRatio: "1",
                  padding: 0,
                  border: "none",
                  color: "inherit",
                  background: color(node),
                  cursor: node.traversable ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "min(2.6vw, 18px)",
                  borderRadius: 3,
                }}
              >
                {id === key(pos) ? "🙂" : gems.has(id) ? "💎" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <p className="margin-top--md">
        {done
          ? `All gems found with ${spent} energy. Try to beat it, or share the seed "${seed}".`
          : "Point at a cell to see the cheapest route, then click to walk there. Mud costs 5 energy per step, so the route goes around it when it can."}
      </p>
    </div>
  );
}
