import { describe, expect, it } from "vitest";
import { PanelCoordinator } from "./panelCoordinator";

describe("PanelCoordinator", () => {
  it("keeps one major presentation panel active", () => {
    const coordinator = new PanelCoordinator();

    coordinator.open("feed");
    expect(coordinator.snapshot.activePanel).toBe("feed");

    coordinator.open("chat");
    expect(coordinator.snapshot.activePanel).toBe("chat");

    coordinator.close();
    expect(coordinator.snapshot.activePanel).toBeNull();
    coordinator.dispose();
  });
});
