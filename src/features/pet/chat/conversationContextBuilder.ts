import type { AiChatMessage } from "../../../platform/ai/aiTypes";
import type { ChatMessage } from "./chatService";

export const CHAT_SYSTEM_INSTRUCTION =
  "你是桌面陪伴角色，用户是妈妈。请用自然、简短、亲近的中文或英文回应，普通聊天优先回复 1 到 3 句，不要动不动列清单，也不要声称拥有不存在的长期记忆。";
export const MAX_RECENT_CONTEXT_MESSAGES = 8;
export const MAX_CONTEXT_CHARACTERS = 4_000;

function characterLength(text: string): number {
  return Array.from(text).length;
}

export function buildConversationContext(
  priorMessages: readonly ChatMessage[],
  currentUserMessage: string,
): readonly AiChatMessage[] {
  const prior = priorMessages
    .slice(-MAX_RECENT_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.text.trim(),
    } satisfies AiChatMessage))
    .filter((message) => message.content !== "");
  const current: AiChatMessage = {
    role: "user",
    content: currentUserMessage,
  };
  const system: AiChatMessage = {
    role: "system",
    content: CHAT_SYSTEM_INSTRUCTION,
  };

  let selectedPrior = [...prior];
  const fixedCharacters = characterLength(system.content) +
    characterLength(current.content);
  const selectedCharacters = () => selectedPrior.reduce(
    (total, message) => total + characterLength(message.content),
    0,
  );

  while (
    selectedPrior.length > 0 &&
    fixedCharacters + selectedCharacters() > MAX_CONTEXT_CHARACTERS
  ) {
    selectedPrior.shift();
  }

  return [system, ...selectedPrior, current];
}
