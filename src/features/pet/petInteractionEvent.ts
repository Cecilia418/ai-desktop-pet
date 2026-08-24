export type PetInteractionEventType =
  | "CLICK"
  | "PET"
  | "POKE"
  | "DRAG_START"
  | "DRAG_MOVE"
  | "DRAG_END"
  | "FEED"
  | "CHAT_START"
  | "CHAT_SEND"
  | "CHAT_CLOSE"
  | "WAKE";

export type PetInteractionSource =
  | "pointer"
  | "keyboard"
  | "system"
  | "debug"
  | "ai";

export type PetInteractionRegion = "CHARACTER" | "HEAD" | "BODY";

export interface ClickInteractionPayload {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly durationMs: number;
  readonly movementPx: number;
}

export interface PetInteractionPayload {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly holdDurationMs: number;
  readonly repeatIndex: number;
}

export interface PointerDragPayload {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly deltaX?: number;
  readonly deltaY?: number;
}

export interface PointerDragEndPayload extends PointerDragPayload {
  readonly cancelled?: boolean;
}

export interface PokeInteractionPayload {
  readonly durationMs: number;
  readonly source: "short-click";
}

export interface FeedInteractionPayload {
  readonly foodId: string;
}

export interface ChatSendInteractionPayload {
  readonly message: string;
}

export interface EmptyInteractionPayload {
  readonly kind: "empty";
}

export interface WakeInteractionPayload {
  readonly reason: "user-interrupt";
}

export interface PetInteractionEventBase<
  TType extends PetInteractionEventType,
  TPayload,
> {
  readonly type: TType;
  readonly timestamp: number;
  readonly source: PetInteractionSource;
  readonly payload: TPayload;
}

export type ClickInteractionEvent = PetInteractionEventBase<
  "CLICK",
  ClickInteractionPayload
> & {
  readonly region: PetInteractionRegion;
};

export type PetInteraction = PetInteractionEventBase<
  "PET",
  PetInteractionPayload
> & {
  readonly region: "HEAD";
};

export type PokeInteractionEvent = PetInteractionEventBase<
  "POKE",
  PokeInteractionPayload
> & {
  readonly region: "HEAD" | "BODY";
};

export type DragStartInteractionEvent = PetInteractionEventBase<
  "DRAG_START",
  PointerDragPayload
> & {
  readonly region: PetInteractionRegion;
};

export type DragMoveInteractionEvent = PetInteractionEventBase<
  "DRAG_MOVE",
  PointerDragPayload
> & {
  readonly region: PetInteractionRegion;
};

export type DragEndInteractionEvent = PetInteractionEventBase<
  "DRAG_END",
  PointerDragEndPayload
> & {
  readonly region: PetInteractionRegion;
};

export type FeedInteractionEvent = PetInteractionEventBase<
  "FEED",
  FeedInteractionPayload
>;

export type ChatStartInteractionEvent = PetInteractionEventBase<
  "CHAT_START",
  EmptyInteractionPayload
>;

export type ChatSendInteractionEvent = PetInteractionEventBase<
  "CHAT_SEND",
  ChatSendInteractionPayload
>;

export type ChatCloseInteractionEvent = PetInteractionEventBase<
  "CHAT_CLOSE",
  EmptyInteractionPayload
>;

export type WakeInteractionEvent = PetInteractionEventBase<
  "WAKE",
  WakeInteractionPayload
>;

export type PetInteractionEvent =
  | ClickInteractionEvent
  | PetInteraction
  | PokeInteractionEvent
  | DragStartInteractionEvent
  | DragMoveInteractionEvent
  | DragEndInteractionEvent
  | FeedInteractionEvent
  | ChatStartInteractionEvent
  | ChatSendInteractionEvent
  | ChatCloseInteractionEvent
  | WakeInteractionEvent;

export type PetInteractionEventInput<
  TType extends PetInteractionEventType,
> = {
  readonly type: TType;
} & Omit<Extract<PetInteractionEvent, { type: TType }>, "type" | "timestamp"> & {
  readonly timestamp?: number;
};

export function createPetInteractionEvent<TType extends PetInteractionEventType>(
  input: PetInteractionEventInput<TType>,
): Extract<PetInteractionEvent, { type: TType }> {
  const { timestamp, ...event } = input;
  return {
    ...event,
    timestamp: timestamp ?? Date.now(),
  } as Extract<PetInteractionEvent, { type: TType }>;
}
