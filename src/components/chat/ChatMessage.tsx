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
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  // Check if this is a multi-select question
  const isMultiSelect = message.options?.some(opt => opt.multiSelect) ?? false;
  // Get selectable options (exclude navigation options like skip/back)
  const selectableOptions = message.options?.filter(opt => opt.value !== "skip" && opt.value !== "back") ?? [];
  const navigationOptions = message.options?.filter(opt => opt.value === "skip" || opt.value === "back") ?? [];

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

  const handleOptionClick = (value: string) => {
    if (!isMultiSelect) {
      onOptionSelect?.(value);
      return;
    }

    // For multi-select, toggle selection
    setSelectedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return newSet;
    });
  };

  const handleMultiSelectDone = () => {
    if (selectedOptions.size === 0) return;
    
    // If all selectable options are selected, treat as "no preference"
    const allSelected = selectableOptions.every(opt => selectedOptions.has(opt.value));
    if (allSelected) {
      onOptionSelect?.("any");
    } else {
      // Join selected values with comma
      onOptionSelect?.(Array.from(selectedOptions).join(","));
    }
  };

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
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {selectableOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.value)}
                  className={cn(
                    "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95",
                    isMultiSelect && selectedOptions.has(option.value)
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : "bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground"
                  )}
                >
                  {isMultiSelect && selectedOptions.has(option.value) && "✓ "}
                  {option.label}
                </button>
              ))}
            </div>
            
            {isMultiSelect && (
              <button
                onClick={handleMultiSelectDone}
                disabled={selectedOptions.size === 0}
                className={cn(
                  "px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200",
                  selectedOptions.size > 0
                    ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                Done ({selectedOptions.size} selected)
              </button>
            )}
            
            {navigationOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 border-t border-border/50">
                {navigationOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onOptionSelect?.(option.value)}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-full text-xs sm:text-sm font-medium transition-all duration-200"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
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
