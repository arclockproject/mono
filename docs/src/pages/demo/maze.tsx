import DemoLayout from "./_layout/DemoLayout";
import { SOURCES } from "./_layout/sources";

const load = () => import("./_app/Maze");

export default function MazeDemoPage() {
  return (
    <DemoLayout
      title="Gem maze"
      description="A small game built from AStar, SeededRandom, AudioInstant and LocalStorage. Collect every gem using as little energy as you can."
      load={load}
      source={SOURCES.maze}
    />
  );
}
