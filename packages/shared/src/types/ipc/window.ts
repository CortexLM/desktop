/**
 * IPC contracts for the custom window chrome.
 *
 * The app draws its own title bar (native frames carry the File/Edit menu strip
 * and a system-styled bar that fights the design), so the renderer needs a way
 * to do what the frame used to: minimize, toggle maximize, close, and reflect
 * the maximized state on its restore button.
 */

export interface WindowMaximizedEvent {
  maximized: boolean;
}

export interface IsWindowMaximizedResponse {
  maximized: boolean;
}
