import DemoLayout from "./_layout/DemoLayout";
import { SOURCES } from "./_layout/sources";

const load = () => import("./_app/Media");

export default function MediaDemoPage() {
  return (
    <DemoLayout
      title="Media library"
      description="Player, GalleryBrowser, Reader, Image, LocalStorage and Time in one app. Start a video, then switch tabs: the music keeps playing in the mini player, and Resume brings you back."
      load={load}
      source={SOURCES.media}
    />
  );
}
