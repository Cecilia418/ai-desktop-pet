import { describe, expect, it } from "vitest";

import { ChatService } from "./chatService";
import type { ChatProvider, ChatProviderRequest } from "./chatProvider";

describe("ChatService", () => {
  it("uses a typed provider seam and owns the in-memory transcript", async () => {
    const calls: ChatProviderRequest[] = [];
    const provider: ChatProvider = {
      respond: async (request) => {
        calls.push(request);
        return { text: "本地回复" };
      },
    };
    const service = new ChatService(provider);

    service.open();
    const response = await service.send("妈妈今天好累");

    expect(response).toBe("本地回复");
    expect(calls).toHaveLength(1);
    expect(calls[0].messages[calls[0].messages.length - 1]).toEqual({
      role: "user",
      content: "妈妈今天好累",
    });
    expect(service.snapshot).toMatchObject({
      isOpen: true,
      pending: false,
      status: "response-received",
      messages: [
        { role: "user", text: "妈妈今天好累" },
        { role: "assistant", text: "本地回复" },
      ],
    });

    service.close();
    expect(service.snapshot.isOpen).toBe(false);
    expect(service.snapshot.messages).toHaveLength(2);
    service.open();
    expect(service.snapshot.messages).toHaveLength(2);
    service.dispose();
  });

  it("keeps the current user message exactly once and preserves message order", async () => {
    const calls: ChatProviderRequest[] = [];
    const provider: ChatProvider = {
      respond: async (request) => {
        calls.push(request);
        return {
          text: request.messages[request.messages.length - 1]?.content ?? "",
        };
      },
    };
    const service = new ChatService(provider);
    service.open();

    await service.send("第一句");
    await service.send("第二句");

    expect(calls[1].messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(calls[1].messages.filter((message) => message.content === "第二句"))
      .toHaveLength(1);
    expect(calls[1].messages[calls[1].messages.length - 1]?.content).toBe("第二句");
    service.dispose();
  });

  it("retires a pending request on close and ignores its late response", async () => {
    const cancelIds: string[] = [];
    let resolveResponse: ((response: { readonly text: string }) => void) | undefined;
    const provider: ChatProvider = {
      respond: async () => new Promise((resolve) => {
        resolveResponse = resolve;
      }),
      cancel: async (requestId) => {
        cancelIds.push(requestId);
      },
    };
    const service = new ChatService(provider);
    service.open();

    const pending = service.send("这条回复会迟到");
    expect(service.snapshot.pending).toBe(true);
    service.close();
    expect(cancelIds).toHaveLength(1);
    expect(service.snapshot.messages).toEqual([
      { role: "user", text: "这条回复会迟到" },
    ]);

    service.open();
    resolveResponse?.({ text: "迟到的回复" });
    await pending;

    expect(service.snapshot.messages).toEqual([
      { role: "user", text: "这条回复会迟到" },
    ]);
    expect(service.snapshot.pending).toBe(false);
    service.dispose();
  });

  it("does not send empty messages", async () => {
    let callCount = 0;
    const provider: ChatProvider = {
      respond: async () => {
        callCount += 1;
        return { text: "should not be called" };
      },
    };
    const service = new ChatService(provider);
    service.open();

    expect(await service.send("  ")).toBeNull();
    expect(callCount).toBe(0);
    expect(service.snapshot.messages).toEqual([]);
    service.dispose();
  });
});
