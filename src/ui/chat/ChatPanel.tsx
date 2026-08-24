import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { PetInteractionEvent } from "../../features/pet/petInteractionEvent";
import {
  createPetInteractionEvent,
} from "../../features/pet/petInteractionEvent";
import type {
  ChatMessage,
  ChatServiceSnapshot,
} from "../../features/pet/chat/chatService";
import { Button, Panel, PanelHeader } from "../design-system";

interface ChatPanelProps {
  readonly snapshot: ChatServiceSnapshot;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly onEvent: (event: PetInteractionEvent) => void;
  readonly onClose: () => void;
}

export function ChatPanel({
  snapshot,
  panelRef,
  onEvent,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = transcriptRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [snapshot.messages.length, snapshot.pending]);

  const send = () => {
    const message = input.trim();
    if (!message || snapshot.pending) {
      return;
    }
    onEvent(
      createPetInteractionEvent({
        type: "CHAT_SEND",
        source: "pointer",
        payload: { message },
      }),
    );
    setInput("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div ref={panelRef} className="pet-panel-shell pet-panel-shell--chat">
      <Panel className="pet-chat-panel" tone="blue">
        <PanelHeader
          title="和女儿聊天"
          subtitle="陪着妈妈，慢慢说"
          onClose={onClose}
          closeLabel="关闭聊天"
        />
        <div
          ref={transcriptRef}
          className="pet-chat-transcript"
          aria-live="polite"
          aria-label="聊天记录"
        >
          {snapshot.messages.length === 0 ? (
            <p className="pet-chat-empty">妈妈想和我聊什么呀？</p>
          ) : null}
          {snapshot.messages.map((message, index) => (
            <ChatMessageBubble
              key={message.role + "-" + index}
              message={message}
            />
          ))}
          {snapshot.pending ? (
            <p className="pet-chat-pending">女儿想一想……</p>
          ) : null}
          {snapshot.error ? (
            <p className="pet-chat-error" role="alert">
              {snapshot.error}
            </p>
          ) : null}
        </div>
        <form className="pet-chat-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="pet-chat-input">
            聊天内容
          </label>
          <textarea
            id="pet-chat-input"
            value={input}
            rows={1}
            maxLength={160}
            placeholder="写一句话给女儿"
            disabled={snapshot.pending}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={snapshot.pending || input.trim() === ""}
            aria-label="发送消息"
          >
            发送
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function ChatMessageBubble({ message }: { readonly message: ChatMessage }) {
  return (
    <p className={"pet-chat-message pet-chat-message--" + message.role}>
      <span className="pet-chat-message__role">
        {message.role === "user" ? "妈妈" : "女儿"}
      </span>
      <span>{message.text}</span>
    </p>
  );
}
