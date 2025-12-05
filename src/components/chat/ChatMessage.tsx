import { ChatMessage as ChatMessageType } from "@/types/dog";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface ChatMessageProps {
  message: ChatMessageType;
  onOptionSelect?: (value: string) => void;
}

export function ChatMessage({ message, onOptionSelect }: ChatMessageProps) {
  const isBot = message.role === "bot";
  const [showBark, setShowBark] = useState(false);
  const [isExcited, setIsExcited] = useState(false);

  // Check if Scout is excited (contains excitement indicators)
  const isScoutExcited = isBot && (
    message.content.includes("!") ||
    message.content.includes("*wags") ||
    message.content.includes("*tail") ||
    message.content.includes("*bounces") ||
    message.content.includes("*spins")
  );

  useEffect(() => {
    if (isScoutExcited) {
      setIsExcited(true);
      setShowBark(true);
      const barkTimer = setTimeout(() => setShowBark(false), 500);
      const excitedTimer = setTimeout(() => setIsExcited(false), 2000);
      return () => {
        clearTimeout(barkTimer);
        clearTimeout(excitedTimer);
      };
    }
  }, [message.content, isScoutExcited]);

  return (
    <div
      className={cn(
        "flex gap-2 sm:gap-3 animate-fade-in",
        isBot ? "justify-start" : "justify-end"
      )}
    >
      {isBot && (
        <div className="relative">
          <div className={cn(
            "w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md transition-all",
            isExcited && "animate-bounce-excited"
          )}>
            <span className={cn("text-base sm:text-lg", isExcited && "animate-wag")} title="Melon - Australian Shepherd Mix">🐶</span>
          </div>
          {showBark && (
            <span className="absolute -top-2 -right-1 text-xs animate-bark">🐾</span>
          )}
        </div>
      )}

      <div className={cn("max-w-[85%] sm:max-w-[80%] space-y-2", !isBot && "order-first")}>
        <div className={isBot ? "chat-bubble-bot" : "chat-bubble-user"}>
          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.options && message.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
            {message.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onOptionSelect?.(option.value)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground rounded-full text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isBot && (
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-base sm:text-lg">😊</span>
        </div>
      )}
    </div>
  );
}
