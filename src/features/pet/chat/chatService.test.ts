import { describe, expect, it } from "vitest";

import { ChatService } from "./chatService";
import type { ChatProvider } from "./chatProvider";

describe("ChatService", () => {
  it("uses the local provider seam and owns shell state", async () => {
    const calls: string[] = [];
    const provider: ChatProvider = {
      respond: async (message) => {
        calls.push(message);
        return "本地回复";
      },
    };
    const service = new ChatService(provider);

    service.open();
    const response = await service.send("妈妈今天好累");

    expect(response).toBe("本地回复");
    expect(calls).toEqual(["妈妈今天好累"]);
    expect(service.snapshot).toMatchObject({
      isOpen: true,
      pending: false,
      messages: [
        { role: "user", text: "妈妈今天好累" },
        { role: "assistant", text: "本地回复" },
      ],
    });
    service.close();
    expect(service.snapshot.isOpen).toBe(false);
    expect(service.snapshot.messages).toEqual([]);
    service.dispose();
  });

  it("does not send empty messages", async () => {
    const provider: ChatProvider = {
      respond: async () => "should not be called",
    };
    const service = new ChatService(provider);
    service.open();

    expect(await service.send("  ")).toBeNull();
    expect(service.snapshot.messages).toEqual([]);
    service.dispose();
  });
});
