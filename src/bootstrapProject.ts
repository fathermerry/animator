import { getDefaultProjectStorage } from "./lib/projectStorage";
import { useProjectStore } from "./store/projectStore";

/** Restore active project from the default storage (IndexedDB) before first paint. */
export async function hydrateProjectFromStorage(): Promise<void> {
  try {
    const slice = await getDefaultProjectStorage().bootstrap();
    useProjectStore.setState({
      project: slice.project,
      assetsConfigs: slice.assetsConfigs,
      scenes: slice.scenes,
      renders: slice.renders,
      frames: slice.frames,
      renderingFrameIds: {},
      frameRenderErrors: {},
    });
  } catch (e) {
    console.error("Could not restore saved project from storage", e);
  }
}
