export const CHAT_BUBBLE_MAX_CHARACTERS = 72;

export function formatChatBubbleText(text: string): string {
  const normalized = text.trim();
  if (Array.from(normalized).length <= CHAT_BUBBLE_MAX_CHARACTERS) {
    return normalized;
  }

  const characters = Array.from(normalized);
  const boundary = characters
    .slice(0, CHAT_BUBBLE_MAX_CHARACTERS)
    .findIndex((character) => /[。！？!?\n.]/u.test(character));
  const cutAt = boundary >= 0 ? boundary + 1 : CHAT_BUBBLE_MAX_CHARACTERS;
  const shortened = characters.slice(0, cutAt).join("").trim();
  return shortened + (cutAt < characters.length ? "…" : "");
}
