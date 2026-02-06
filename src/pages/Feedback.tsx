import { useState } from "react";
import { MessageSquare, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

const feedbackTypes = [
  { value: "experience", label: "App Experience" },
  { value: "matching", label: "Dog Matching Quality" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
];

export default function Feedback() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [feedbackType, setFeedbackType] = useState("experience");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter your feedback before submitting.",
        variant: "destructive",
      });
      return;
    }

    // For now, just show success (no backend storage per constraints)
    // Note: In production, this should be sent to a backend endpoint
    setSubmitted(true);
    toast({
      title: "Thank you!",
      description: "Your feedback has been submitted.",
    });
  };

  if (submitted) {
    return (
      <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
        <Card className="text-center py-10">
          <CardContent className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Thanks for your feedback!
            </h2>
            <p className="text-muted-foreground">
              We appreciate you taking the time to help us improve PawMatch.
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline">
              Submit More Feedback
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">
          Share Your Feedback
        </h1>
        <p className="text-muted-foreground">
          Help us improve PawMatch by sharing your thoughts, reporting issues, or suggesting features.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feedback Form</CardTitle>
          <CardDescription>All fields except email are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label>What type of feedback?</Label>
              <RadioGroup
                value={feedbackType}
                onValueChange={setFeedbackType}
                className="grid grid-cols-2 gap-2"
              >
                {feedbackTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.value} id={type.value} />
                    <Label htmlFor={type.value} className="cursor-pointer text-sm">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Your Feedback *</Label>
              <Textarea
                id="message"
                placeholder="Tell us what's on your mind..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Only if you'd like us to follow up with you.
              </p>
            </div>

            <Button type="submit" className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Submit Feedback
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
