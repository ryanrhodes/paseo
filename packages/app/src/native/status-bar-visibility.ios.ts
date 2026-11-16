// Fork: hides the status bar through view-controller status bar appearance (see
// modules/paseo-window-layout). React Native's StatusBar `hidden` uses the app-wide API, which has
// no effect in a scene-based app.
import { requireOptionalNativeModule } from "expo-modules-core";

interface PaseoWindowLayoutModule {
  setStatusBarHidden(hidden: boolean): void;
}

const module = requireOptionalNativeModule<PaseoWindowLayoutModule>("PaseoWindowLayout");

export function setStatusBarHidden(hidden: boolean): void {
  module?.setStatusBarHidden?.(hidden);
}
