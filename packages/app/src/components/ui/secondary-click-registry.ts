// Fork: routes iPadOS secondary clicks to the context-menu trigger under the pointer.
// The native side reports window coordinates; each mounted trigger registers itself, and on a
// click the smallest visible trigger containing the point opens its menu there.
import type { View } from "react-native";
import type { EventSubscription } from "expo-modules-core";
import { addSecondaryClickListener, type SecondaryClickPoint } from "@/native/secondary-click";

export interface SecondaryClickTarget {
  getNode: () => View | null;
  open: (point: { pageX: number; pageY: number }) => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const targets = new Set<SecondaryClickTarget>();
let subscription: EventSubscription | null = null;

function measure(node: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    try {
      node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(null);
    }
  });
}

/** Picks the smallest non-empty rect containing the point; nested triggers win over parents. */
export function pickSecondaryClickTarget<T>(
  candidates: readonly { target: T; rect: Rect | null }[],
  point: SecondaryClickPoint,
): T | null {
  let best: { target: T; area: number } | null = null;
  for (const { target, rect } of candidates) {
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    const inside =
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height;
    if (!inside) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { target, area };
  }
  return best?.target ?? null;
}

async function handleSecondaryClick(point: SecondaryClickPoint) {
  const entries = [...targets];
  const candidates = await Promise.all(
    entries.map(async (target) => {
      const node = target.getNode();
      return { target, rect: node ? await measure(node) : null };
    }),
  );
  pickSecondaryClickTarget(candidates, point)?.open({ pageX: point.x, pageY: point.y });
}

export function registerSecondaryClickTarget(target: SecondaryClickTarget): () => void {
  targets.add(target);
  if (!subscription) {
    subscription = addSecondaryClickListener((point) => {
      void handleSecondaryClick(point);
    });
  }
  return () => {
    targets.delete(target);
    if (targets.size === 0 && subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}
