import { useMemo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { SurfaceOcclusionsContext, useWindowLayout } from "./context";
import {
  resolveTrailingBarOcclusions,
  resolveWorkspaceActionPlacement,
  type DesktopDivisionLayout,
} from "./model";

/** Consume horizontal safe areas once, including compact content beside a vertical bar. */
export function WindowLayoutSurface({
  children,
  compact,
  style,
}: {
  children: ReactNode;
  compact: boolean;
  style: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const layout = useWindowLayout();
  const usesBar = resolveWorkspaceActionPlacement(layout) === "vertical-bar";
  // Fork: a wide surface beside a trailing vertical bar runs to the screen edge, like Safari;
  // header and tab rows pad around the bar's occlusions themselves.
  const occlusions = useMemo(
    () => resolveTrailingBarOcclusions(layout, compact),
    [compact, layout],
  );
  const paddingRight = occlusions ? 0 : insets.right;
  const surfaceStyle = useMemo(
    () => [style, (!compact || usesBar) && { paddingLeft: insets.left, paddingRight }],
    [style, compact, usesBar, insets.left, paddingRight],
  );
  const contentInsets = useMemo(() => {
    if (compact && usesBar) return { ...insets, left: 0, right: 0 };
    return occlusions ? { ...insets, right: 0 } : insets;
  }, [compact, usesBar, insets, occlusions]);
  return (
    <View style={surfaceStyle}>
      <SafeAreaInsetsContext.Provider value={contentInsets}>
        <SurfaceOcclusionsContext.Provider value={occlusions}>
          {children}
        </SurfaceOcclusionsContext.Provider>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

export function WindowLayoutDivisionGap({
  layout,
  sidebarVisible,
  compact,
}: {
  layout: DesktopDivisionLayout | null;
  sidebarVisible: boolean;
  compact: boolean;
}) {
  const style = useMemo(
    () => ({
      width: layout ? layout.gap + (sidebarVisible ? 0 : layout.sidebarWidth) : 0,
    }),
    [layout, sidebarVisible],
  );
  return !compact && layout ? <View style={[styles.divisionGap, style]} /> : null;
}

const styles = StyleSheet.create((theme) => ({
  divisionGap: {
    backgroundColor: theme.colors.surfaceSidebar,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
}));
