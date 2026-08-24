import type { SpeechBubbleSnapshot } from "../../features/pet/speechBubbleController";

export function SpeechBubble({ snapshot }: { readonly snapshot: SpeechBubbleSnapshot }) {
  if (snapshot.state === "hidden" || !snapshot.message) {
    return null;
  }

  return (
    <div
      className={"pet-bubble pet-bubble-" + snapshot.state}
      role="status"
      aria-live="polite"
    >
      {snapshot.message}
    </div>
  );
}
