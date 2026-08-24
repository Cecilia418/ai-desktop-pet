import { describe, expect, it } from "vitest";

import {
  CHAT_SYSTEM_INSTRUCTION,
  MAX_CONTEXT_CHARACTERS,
  buildConversationContext,
} from "./conversationContextBuilder";

describe("buildConversationContext", () => {
  it("orders system, prior session messages, and the current user exactly once", () => {
    const context = buildConversationContext(
      [
        { role: "user", text: "之前的问题" },
        { role: "assistant", text: "之前的回答" },
      ],
      "当前问题",
    );

    expect(context).toEqual([
      { role: "system", content: CHAT_SYSTEM_INSTRUCTION },
      { role: "user", content: "之前的问题" },
      { role: "assistant", content: "之前的回答" },
      { role: "user", content: "当前问题" },
    ]);
    expect(context.filter((message) => message.content === "当前问题"))
      .toHaveLength(1);
  });

  it("drops oldest prior messages first while retaining the current message", () => {
    const current = "当前消息";
    const longPrior = "x".repeat(MAX_CONTEXT_CHARACTERS);
    const context = buildConversationContext(
      [
        { role: "user", text: longPrior },
        { role: "assistant", text: "保留的 prior" },
      ],
      current,
    );

    expect(context[context.length - 1]).toEqual({ role: "user", content: current });
    expect(context.some((message) => message.content === longPrior)).toBe(false);
    expect(context.some((message) => message.content === "保留的 prior"))
      .toBe(true);
  });
});
