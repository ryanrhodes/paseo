// Only iOS has the native status bar hook; elsewhere the top bar toggle leaves the status bar alone.
export function setStatusBarHidden(_hidden: boolean): void {}
