import type { EventSubscription } from "expo-modules-core";

export interface SecondaryClickPoint {
  x: number;
  y: number;
}

// Web handles right-click through onContextMenu; Android has no native module.
export function addSecondaryClickListener(
  _handler: (point: SecondaryClickPoint) => void,
): EventSubscription {
  return { remove: () => {} };
}
