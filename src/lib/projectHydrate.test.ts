import { describe, expect, it } from "vitest";

import defaultProject from "@/data/default-project.json";
import { projectFromConfigJson } from "@/lib/projectHydrate";
import { SAMPLE_PROJECT_ID } from "@/lib/sampleProject";

describe("projectFromConfigJson", () => {
  it("hydrates the bundled default project file with stable id and fallback style kit", () => {
    const bundle = projectFromConfigJson(defaultProject);
    expect(bundle.project.id).toBe(SAMPLE_PROJECT_ID);
    expect(bundle.styleConfigs.length).toBeGreaterThanOrEqual(1);
    expect(bundle.styleConfigs.some((c) => c.id === bundle.project.styleConfigId)).toBe(true);
    expect(Array.isArray(bundle.scenes)).toBe(true);
    expect(Array.isArray(bundle.frames)).toBe(true);
  });

  it("renumbers kit character ids onto scene.characterIds", () => {
    const raw = {
      id: "proj-hydrate-test",
      name: "Hydrate test",
      createdAt: "2026-01-01T00:00:00.000Z",
      prompt: "",
      styleConfigId: "cfg-1",
      styleConfigs: [
        {
          id: "cfg-1",
          name: "Kit",
          assets: {
            id: "bundle-1",
            name: "Assets",
            description: "Desc",
            notes: "",
            background: { color: "#111111" },
            textStyles: [],
            characters: [
              { id: "legacyA", name: "Alice", description: "" },
              { id: "legacyB", name: "Bob", description: "" },
            ],
          },
        },
      ],
      scenes: [
        {
          id: "scene-1",
          projectId: "proj-hydrate-test",
          index: 0,
          title: "One",
          description: "Beat",
          voiceoverText: "VO",
          durationSeconds: 8,
          characterIds: ["legacyA", "legacyB"],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      renders: [],
      frames: [
        {
          id: "frame-1",
          projectId: "proj-hydrate-test",
          sceneId: "scene-1",
          renderId: "render-1",
          index: 0,
          src: "",
          description: "KF",
        },
      ],
    };

    const bundle = projectFromConfigJson(raw);
    expect(bundle.project.styleConfigId).toBe("cfg-1");
    expect(bundle.scenes).toHaveLength(1);
    expect(bundle.scenes[0]!.characterIds).toEqual(["C01", "C02"]);
    expect(bundle.frames).toHaveLength(1);
    expect(bundle.frames[0]!.sceneId).toBe("scene-1");
  });
});
