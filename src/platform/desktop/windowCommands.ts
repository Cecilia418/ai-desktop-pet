import {
  desktopWindowManager,
  type DesktopWindowManager,
} from "./windowManager";

export interface WindowCommand {
  hide(): Promise<void>;
  show(): Promise<void>;
}

export function createWindowCommand(
  windowManager: DesktopWindowManager,
): WindowCommand {
  return {
    hide: async () => {
      if (import.meta.env.DEV) {
        console.debug("WindowCommand.hide()");
      }
      await windowManager.hide();
    },
    show: () => windowManager.show(),
  };
}

export const desktopWindowCommand = createWindowCommand(desktopWindowManager);
