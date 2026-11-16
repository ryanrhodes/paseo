// Fork: a button that hides the workspace header row and the system status bar (time, signal,
// Live Activities) for more vertical space on native wide layouts (iPad, unfolded iPhone Duo).
// Tabs and panes stay. Not persisted: the top bar comes back on the next launch.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { withUnistyles } from "react-native-unistyles";
import { PanelTopClose, PanelTopOpen } from "lucide-react-native";
import { create } from "zustand";
import { useIsCompactFormFactor } from "@/constants/layout";
import { isNative } from "@/constants/platform";
import { paneContentToolbarIconSize, ToolbarButton } from "@/components/ui/pane-content-toolbar";
import type { Theme } from "@/styles/theme";
import { setStatusBarHidden } from "@/native/status-bar-visibility";

interface TopBarStore {
  hidden: boolean;
  toggle: () => void;
}

export const useTopBarStore = create<TopBarStore>((set) => ({
  hidden: false,
  toggle: () => set((state) => ({ hidden: !state.hidden })),
}));

/** Whether the top bar should be hidden right now. Compact layouts and web always show it. */
export function useTopBarHidden(): boolean {
  const hidden = useTopBarStore((state) => state.hidden);
  const isCompact = useIsCompactFormFactor();
  return isNative && !isCompact && hidden;
}

/** Whether the toggle button belongs in this layout at all. */
export function useTopBarToggleAvailable(): boolean {
  const isCompact = useIsCompactFormFactor();
  return isNative && !isCompact;
}

/** Mount once near the app root: hides the system status bar while the top bar is hidden. */
export function TopBarStatusBar() {
  const hidden = useTopBarHidden();
  useEffect(() => {
    setStatusBarHidden(hidden);
  }, [hidden]);
  return null;
}

const ThemedPanelTopClose = withUnistyles(PanelTopClose);
const ThemedPanelTopOpen = withUnistyles(PanelTopOpen);
const GLYPH_SIZE = paneContentToolbarIconSize(false);
const mutedColorMapping = (theme: Theme) => ({ color: theme.colors.foregroundExtraMuted });

export function TopBarToggleButton() {
  const { t } = useTranslation();
  const hidden = useTopBarHidden();
  const toggle = useTopBarStore((state) => state.toggle);
  return (
    <ToolbarButton
      label={t(hidden ? "workspace.tabs.actions.showTopBar" : "workspace.tabs.actions.hideTopBar")}
      selected={hidden}
      testID="workspace-toggle-top-bar"
      onPress={toggle}
    >
      {hidden ? (
        <ThemedPanelTopOpen size={GLYPH_SIZE} uniProps={mutedColorMapping} />
      ) : (
        <ThemedPanelTopClose size={GLYPH_SIZE} uniProps={mutedColorMapping} />
      )}
    </ToolbarButton>
  );
}
