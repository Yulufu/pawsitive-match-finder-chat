import { ChatMessage as ChatMessageType } from "@/types/dog";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
  onOptionSelect?: (value: string) => void;
}

export function ChatMessage({ message, onOptionSelect }: ChatMessageProps) {
  const isBot = message.role === "bot";

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isBot ? "justify-start" : "justify-end"
      )}
    >
      {isBot && (
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-lg">🐶</span>
        </div>
      )}

      <div className={cn("max-w-[80%] space-y-2", !isBot && "order-first")}>
        <div className={isBot ? "chat-bubble-bot" : "chat-bubble-user"}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.options && message.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onOptionSelect?.(option.value)}
                className="px-4 py-2 bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isBot && (
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <span className="text-lg">😊</span>
        </div>
      )}
    </div>
  );
}
