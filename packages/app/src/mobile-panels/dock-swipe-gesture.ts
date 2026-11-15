// Fork: swipe the docked left sidebar open and closed on native wide layouts (iPad, unfolded
// iPhone Duo). Upstream's sidebar gestures only drive the sliding overlay; the dock was
// button-only. This is a flick, not an interactive drag: a swipe right from the left edge opens
// the dock, a swipe left that starts on the sidebar closes it.
import { useMemo } from "react";
import { Gesture, PointerType } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { isNative } from "@/constants/platform";
import { usePanelStore } from "@/stores/panel-store";

/** How far from the left edge a swipe must start to open the dock. */
const OPEN_EDGE_WIDTH = 32;
/** Horizontal travel that claims the touch. */
const ACTIVATE_DISTANCE = 18;
/** Vertical travel that gives the touch back to scrolling. */
const FAIL_VERTICAL_DISTANCE = 14;
/** Travel or speed that commits the swipe on release. */
const COMMIT_DISTANCE = 60;
const COMMIT_VELOCITY = 500;

export function useDockSidebarSwipeGesture(enabled: boolean) {
  const isOpen = usePanelStore((state) => state.desktop.agentListOpen);
  const focusMode = usePanelStore((state) => state.desktop.focusModeEnabled);
  const sidebarWidth = usePanelStore((state) => state.sidebarWidth);
  const openDock = usePanelStore((state) => state.openDesktopAgentList);
  const closeDock = usePanelStore((state) => state.closeDesktopAgentList);
  const insets = useSafeAreaInsets();

  const gate = useDerivedValue(() => enabled && !focusMode, [enabled, focusMode]);
  const openNow = useDerivedValue(() => isOpen, [isOpen]);
  const openEdge = useDerivedValue(() => insets.left + OPEN_EDGE_WIDTH, [insets.left]);
  const dockRight = useDerivedValue(() => insets.left + sidebarWidth, [insets.left, sidebarWidth]);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(isNative)
        .manualActivation(true)
        .onTouchesDown((event, stateManager) => {
          const touch = event.changedTouches[0];
          if (!gate.value || event.pointerType !== PointerType.TOUCH || !touch) {
            stateManager.fail();
            return;
          }
          const inRegion = openNow.value
            ? touch.absoluteX <= dockRight.value
            : touch.absoluteX <= openEdge.value;
          if (!inRegion) {
            stateManager.fail();
            return;
          }
          startX.value = touch.absoluteX;
          startY.value = touch.absoluteY;
        })
        .onTouchesMove((event, stateManager) => {
          const touch = event.changedTouches[0];
          if (!touch || event.numberOfTouches !== 1) {
            stateManager.fail();
            return;
          }
          const deltaX = touch.absoluteX - startX.value;
          const deltaY = touch.absoluteY - startY.value;
          if (Math.abs(deltaY) > FAIL_VERTICAL_DISTANCE && Math.abs(deltaY) > Math.abs(deltaX)) {
            stateManager.fail();
            return;
          }
          // Opening wants a rightward swipe, closing a leftward one.
          const towardIntent = openNow.value ? -deltaX : deltaX;
          if (towardIntent < -ACTIVATE_DISTANCE) {
            stateManager.fail();
            return;
          }
          if (towardIntent > ACTIVATE_DISTANCE) {
            stateManager.activate();
          }
        })
        .onEnd((event, success) => {
          if (!success) return;
          if (openNow.value) {
            if (event.translationX < -COMMIT_DISTANCE || event.velocityX < -COMMIT_VELOCITY) {
              scheduleOnRN(closeDock);
            }
          } else if (event.translationX > COMMIT_DISTANCE || event.velocityX > COMMIT_VELOCITY) {
            scheduleOnRN(openDock);
          }
        }),
    [closeDock, dockRight, gate, openDock, openEdge, openNow, startX, startY],
  );
}
