import { describe, expect, it } from "vitest";
import { pickSecondaryClickTarget } from "@/components/ui/secondary-click-registry";

describe("pickSecondaryClickTarget", () => {
  const row = { target: "row", rect: { x: 0, y: 0, width: 300, height: 40 } };
  const chip = { target: "chip", rect: { x: 10, y: 5, width: 80, height: 30 } };
  const hidden = { target: "hidden", rect: { x: 0, y: 0, width: 0, height: 0 } };

  it("prefers the smallest trigger containing the point", () => {
    expect(pickSecondaryClickTarget([row, chip, hidden], { x: 20, y: 10 })).toBe("chip");
    expect(pickSecondaryClickTarget([row, chip], { x: 200, y: 10 })).toBe("row");
  });

  it("ignores misses, unmeasured and zero-size triggers", () => {
    expect(pickSecondaryClickTarget([row, chip], { x: 500, y: 500 })).toBeNull();
    expect(
      pickSecondaryClickTarget([{ target: "x", rect: null }, hidden], { x: 0, y: 0 }),
    ).toBeNull();
  });
});
