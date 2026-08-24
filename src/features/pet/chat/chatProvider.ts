export interface ChatProvider {
  respond(message: string): Promise<string>;
}

export class LocalPlaceholderChatProvider implements ChatProvider {
  public respond(_message: string): Promise<string> {
    return Promise.resolve("妈妈，我现在还在学习怎么和你聊天呢～");
  }
}
