// Fork: pointer secondary clicks (trackpad two-finger click, mouse right-click) on iPadOS.
import { requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";

export interface SecondaryClickPoint {
  x: number;
  y: number;
}

interface PaseoSecondaryClickModule {
  addListener(
    eventName: "onSecondaryClick",
    handler: (point: SecondaryClickPoint) => void,
  ): EventSubscription;
}

// Optional so a JS bundle running on a binary built without the module still starts.
const module = requireOptionalNativeModule<PaseoSecondaryClickModule>("PaseoSecondaryClick");

export function addSecondaryClickListener(
  handler: (point: SecondaryClickPoint) => void,
): EventSubscription {
  return module?.addListener("onSecondaryClick", handler) ?? { remove: () => {} };
}
