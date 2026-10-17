import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

interface InStepMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

export function toChatCompletionMessages(messages: InStepMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) =>
    message.role === "user" && message.image
      ? {
          role: "user",
          content: [
            { type: "text", text: message.content },
            { type: "image_url", image_url: { url: message.image, detail: "high" } },
          ],
        }
      : { role: message.role, content: message.content },
  );
}
