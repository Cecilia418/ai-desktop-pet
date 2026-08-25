export type ApplicationShutdownHandler = () => void;

/**
 * Registers a WebView-level application shutdown callback.
 *
 * This boundary is intentionally separate from React component cleanup:
 * StrictMode may mount, clean up, and remount an effect without shutting
 * down the application.
 */
export function registerApplicationShutdown(
  handler: ApplicationShutdownHandler,
): () => void {
  let handled = false;
  const handleBeforeUnload = () => {
    if (handled) {
      return;
    }
    handled = true;
    handler();
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}
