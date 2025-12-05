import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChat } from "@/contexts/ChatContext";
import { Progress } from "@/components/ui/progress";
export default function Chat() {
  const {
    messages,
    isTyping,
    handleUserMessage,
    currentStep,
    totalSteps
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, isTyping]);
  const handleOptionSelect = (value: string) => {
    if (value === "browse") {
      sessionStorage.removeItem('dogsScrollPosition');
      window.scrollTo(0, 0);
      navigate("/dogs");
    } else {
      handleUserMessage(value);
    }
  };
  const progressPercent = currentStep / totalSteps * 100;
  return <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
      <header className="sticky top-0 z-10 text-center py-3 sm:py-4 md:py-6 px-3 sm:px-4 bg-background/95 backdrop-blur-sm">
        <h1 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground">Meet Melon! </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 px-2">
          A friendly Australian Shepherd who wants to introduce you to their friends
        </p>
        
        {/* Progress indicator */}
        <div className="mt-3 sm:mt-4 max-w-[200px] sm:max-w-xs mx-auto">
          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">
            <span>Question {currentStep} of {totalSteps}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5 sm:h-2" />
        </div>
        
      </header>

      <div className="flex-1 overflow-y-auto px-2 sm:px-4 space-y-3 sm:space-y-4 pb-4">
        {messages.map(message => <ChatMessage key={message.id} message={message} onOptionSelect={handleOptionSelect} />)}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border p-2 sm:p-3 md:p-4">
        <ChatInput onSend={handleUserMessage} disabled={isTyping} placeholder="Type your answer..." />
      </div>
    </main>;
}