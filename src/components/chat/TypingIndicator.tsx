export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 animate-bounce-gentle">
        <span className="text-lg">🐕</span>
      </div>

      <div className="chat-bubble-bot">
        <div className="flex items-center gap-1.5 py-1">
          <div className="typing-dot" style={{ animationDelay: "0ms" }} />
          <div className="typing-dot" style={{ animationDelay: "150ms" }} />
          <div className="typing-dot" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
