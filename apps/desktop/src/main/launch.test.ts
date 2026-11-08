import { describe, expect, mock, test } from "bun:test";
import { resolve } from "node:path";

import { launchSettings, type LaunchInput } from "./launch.ts";

const base: LaunchInput = {
  isPackaged: false,
  env: {},
  appPath: "/repo/apps/desktop",
  releaseUserData: () => "/Users/me/Library/Application Support/Weft",
};

describe("an unpackaged run", () => {
  test("keeps its data in apps/desktop/.dev-user-data, and never asks for the release folder", () => {
    const releaseUserData = mock(base.releaseUserData);
    expect(launchSettings({ ...base, releaseUserData })).toEqual({
      userData: "/repo/apps/desktop/.dev-user-data",
      debugPort: undefined,
      rendererUrl: undefined,
      ignored: [],
    });
    expect(releaseUserData).not.toHaveBeenCalled();
  });

  test("can be pointed at another folder, resolved from where it was started", () => {
    expect(
      launchSettings({ ...base, env: { WEFT_USER_DATA: "/tmp/weft-a" } })
        .userData,
    ).toBe("/tmp/weft-a");
    expect(
      launchSettings({ ...base, env: { WEFT_USER_DATA: "here" } }).userData,
    ).toBe(resolve("here"));
  });

  test("opens a debugging port only when asked", () => {
    expect(
      launchSettings({ ...base, env: { WEFT_DEBUG_PORT: "9333" } }).debugPort,
    ).toBe(9333);
    expect(
      launchSettings({ ...base, env: { WEFT_DEBUG_PORT: "" } }).debugPort,
    ).toBeUndefined();
  });

  test.each(["0", "65536", "9333x", "-1", "93.5"])(
    "refuses the debugging port %p",
    (port) => {
      expect(() =>
        launchSettings({ ...base, env: { WEFT_DEBUG_PORT: port } }),
      ).toThrow("WEFT_DEBUG_PORT");
    },
  );

  test("loads the renderer from the dev server it is given", () => {
    const env = { WEFT_RENDERER_URL: "http://localhost:5173/" };
    expect(launchSettings({ ...base, env }).rendererUrl).toBe(
      "http://localhost:5173/",
    );
  });
});

describe("a packaged run", () => {
  const packaged = { ...base, isPackaged: true };

  test("keeps its data in the release folder", () => {
    expect(launchSettings(packaged).userData).toBe(
      "/Users/me/Library/Application Support/Weft",
    );
  });

  test("can be pointed at another folder, and then never asks for the release folder", () => {
    const releaseUserData = mock(base.releaseUserData);
    const env = { WEFT_USER_DATA: "/tmp/weft-b" };
    expect(launchSettings({ ...packaged, env, releaseUserData }).userData).toBe(
      "/tmp/weft-b",
    );
    expect(releaseUserData).not.toHaveBeenCalled();
  });

  test("never opens a debugging port or loads a dev server", () => {
    const env = {
      WEFT_DEBUG_PORT: "9333",
      WEFT_RENDERER_URL: "http://localhost:5173/",
    };
    const launch = launchSettings({ ...packaged, env });
    expect(launch.debugPort).toBeUndefined();
    expect(launch.rendererUrl).toBeUndefined();
    expect(launch.ignored).toEqual(["WEFT_DEBUG_PORT", "WEFT_RENDERER_URL"]);
  });
});
