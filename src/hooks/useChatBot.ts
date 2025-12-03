import { useState, useCallback } from "react";
import { ChatMessage, ChatOption } from "@/types/dog";
import { sampleDogs } from "@/data/sampleDogs";

interface UserPreferences {
  livingSpace?: string;
  hasYard?: boolean;
  activityLevel?: string;
  hasKids?: boolean;
  hasPets?: boolean;
  sizePreference?: string;
}

const createMessage = (
  role: "user" | "bot",
  content: string,
  options?: ChatOption[]
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: new Date(),
  options,
});

const initialMessage = createMessage(
  "bot",
  "Woof! 🐾 Hi there! I'm Buddy, your friendly adoption helper!\n\nI'm so excited to help you find your perfect furry companion. Let's start with a few questions to find dogs that match your lifestyle.\n\nFirst, what type of living space do you have?",
  [
    { id: "1", label: "🏠 House with yard", value: "house_yard" },
    { id: "2", label: "🏡 House without yard", value: "house_no_yard" },
    { id: "3", label: "🏢 Apartment", value: "apartment" },
  ]
);

export function useChatBot() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [isTyping, setIsTyping] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [step, setStep] = useState(0);

  const addBotMessage = useCallback((content: string, options?: ChatOption[]) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, createMessage("bot", content, options)]);
      setIsTyping(false);
    }, 1000 + Math.random() * 500);
  }, []);

  const getRecommendations = useCallback((prefs: UserPreferences) => {
    return sampleDogs.filter((dog) => {
      if (prefs.sizePreference === "small" && dog.size !== "small") return false;
      if (prefs.sizePreference === "large" && dog.size === "small") return false;
      if (prefs.hasKids && !dog.goodWithKids) return false;
      if (prefs.hasPets && !dog.goodWithPets) return false;
      if (prefs.activityLevel === "low" && dog.energyLevel === "high") return false;
      if (prefs.activityLevel === "high" && dog.energyLevel === "low") return false;
      return true;
    });
  }, []);

  const handleUserMessage = useCallback(
    (content: string) => {
      setMessages((prev) => [...prev, createMessage("user", content)]);

      switch (step) {
        case 0:
          // Living space
          setPreferences((prev) => ({
            ...prev,
            livingSpace: content,
            hasYard: content.includes("yard"),
          }));
          setStep(1);
          addBotMessage(
            "Great choice! 🏠\n\nNow, how would you describe your activity level? This helps me find a pup whose energy matches yours!",
            [
              { id: "1", label: "🛋️ Relaxed & chill", value: "low" },
              { id: "2", label: "⚖️ Moderately active", value: "medium" },
              { id: "3", label: "🏃 Very active", value: "high" },
            ]
          );
          break;

        case 1:
          // Activity level
          setPreferences((prev) => ({ ...prev, activityLevel: content }));
          setStep(2);
          addBotMessage(
            "Perfect! I'm getting a better picture already. 🎨\n\nDo you have any children at home?",
            [
              { id: "1", label: "👶 Yes, I have kids", value: "yes" },
              { id: "2", label: "🚫 No children", value: "no" },
            ]
          );
          break;

        case 2:
          // Kids
          setPreferences((prev) => ({ ...prev, hasKids: content === "yes" }));
          setStep(3);
          addBotMessage(
            "Got it! And what about other pets? Do you have any furry (or not-so-furry) friends at home?",
            [
              { id: "1", label: "🐾 Yes, other pets", value: "yes" },
              { id: "2", label: "🚫 No other pets", value: "no" },
            ]
          );
          break;

        case 3:
          // Pets
          setPreferences((prev) => ({ ...prev, hasPets: content === "yes" }));
          setStep(4);
          addBotMessage(
            "Almost there! Last question - do you have a size preference for your new best friend?",
            [
              { id: "1", label: "🐕 Small (under 25 lbs)", value: "small" },
              { id: "2", label: "🐕‍🦺 Medium (25-60 lbs)", value: "medium" },
              { id: "3", label: "🦮 Large (over 60 lbs)", value: "large" },
              { id: "4", label: "💕 Any size works!", value: "any" },
            ]
          );
          break;

        case 4:
          // Size preference & show results
          const finalPrefs = {
            ...preferences,
            sizePreference: content === "any" ? undefined : content,
          };
          setPreferences(finalPrefs);
          setStep(5);

          const matches = getRecommendations(finalPrefs);
          const matchNames = matches.map((d) => d.name).join(", ");

          if (matches.length > 0) {
            addBotMessage(
              `🎉 Wonderful news! Based on your answers, I found ${matches.length} amazing ${matches.length === 1 ? "pup" : "pups"} that could be your perfect match!\n\n✨ Meet: ${matchNames}\n\nHead over to the "Browse Dogs" tab to see their profiles and learn more about each one. Don't forget to tap the ❤️ heart to save your favorites!\n\nIs there anything else you'd like to know?`,
              [
                { id: "1", label: "🔍 Browse Dogs", value: "browse" },
                { id: "2", label: "🔄 Start Over", value: "restart" },
              ]
            );
          } else {
            addBotMessage(
              "Hmm, I couldn't find an exact match with those criteria, but don't give up! Every dog deserves a loving home. 💕\n\nCheck out all our available dogs - you might just find an unexpected connection!",
              [
                { id: "1", label: "🔍 Browse All Dogs", value: "browse" },
                { id: "2", label: "🔄 Start Over", value: "restart" },
              ]
            );
          }
          break;

        case 5:
          // Final interactions
          if (content === "restart" || content.toLowerCase().includes("start over")) {
            setPreferences({});
            setStep(0);
            setMessages([initialMessage]);
          } else {
            addBotMessage(
              "Feel free to browse our available dogs anytime! Each one is special and waiting for their forever home. 🏠💕\n\nIf you want to start fresh with new preferences, just say 'start over'!",
              [
                { id: "1", label: "🔍 Browse Dogs", value: "browse" },
                { id: "2", label: "🔄 Start Over", value: "restart" },
              ]
            );
          }
          break;
      }
    },
    [step, preferences, addBotMessage, getRecommendations]
  );

  return {
    messages,
    isTyping,
    handleUserMessage,
  };
}
