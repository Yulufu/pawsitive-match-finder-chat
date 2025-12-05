import { useState, FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "Type your message..." }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-3 py-2.5 sm:px-4 sm:py-3 bg-secondary rounded-xl sm:rounded-2xl text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
      />
      <Button
        type="submit"
        disabled={disabled || !input.trim()}
        className="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 h-auto"
      >
        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}
