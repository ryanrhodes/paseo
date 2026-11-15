// Fork change: native has no dnd-kit, so there is nothing to drop a dragged tab onto.
// Tabs move between panes through the tab menu instead. Keep the same exports as the web file.
export type SplitDropZonePosition = "center" | "left" | "right" | "top" | "bottom";

export interface SplitDropZoneHover {
  paneId: string;
  position: SplitDropZonePosition;
}

export interface SplitDropZoneProps {
  paneId: string;
  active: boolean;
  preview: SplitDropZoneHover | null;
}

export function buildSplitDropZoneId(paneId: string): string {
  return `split-pane-drop:${paneId}`;
}

export function SplitDropZone(_props: SplitDropZoneProps): null {
  return null;
}
