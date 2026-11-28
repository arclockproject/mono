import DemoLayout from "./_layout/DemoLayout";
import { SOURCES } from "./_layout/sources";

const load = () => import("./_app/Desktop");

export default function DesktopDemoPage() {
  return (
    <DemoLayout
      fullscreen
      title="Desktop"
      description="A small desktop built from Window, FileBrowser, Player, Image, PSDViewer, AudioMixer and MMDPlayer."
      load={load}
      source={SOURCES.desktop}
    />
  );
}
