import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChatBot } from "@/hooks/useChatBot";

export default function Chat() {
  const { messages, isTyping, handleUserMessage } = useChatBot();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleOptionSelect = (value: string) => {
    if (value === "browse") {
      navigate("/dogs");
    } else {
      handleUserMessage(value);
    }
  };

  return (
    <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
      <header className="text-center py-6 px-4">
        <h1 className="text-2xl font-display font-bold text-foreground">
          Find Your Perfect Match
        </h1>
        <p className="text-muted-foreground mt-1">
          Chat with Buddy to discover rescue dogs that fit your lifestyle
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onOptionSelect={handleOptionSelect}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border p-4">
        <ChatInput
          onSend={handleUserMessage}
          disabled={isTyping}
          placeholder="Type your answer or click an option..."
        />
      </div>
    </main>
  );
}
