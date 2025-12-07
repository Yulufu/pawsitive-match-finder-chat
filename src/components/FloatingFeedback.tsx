import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "./FeedbackModal";

export function FloatingFeedback() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="fixed bottom-4 left-4 z-50 gap-2 shadow-lg bg-background hover:bg-accent"
        onClick={() => setFeedbackOpen(true)}
      >
        <MessageSquare className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}