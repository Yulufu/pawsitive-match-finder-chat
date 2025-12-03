import { useState, useCallback } from "react";
import { ChatMessage, ChatOption, Dog } from "@/types/dog";
import { sampleDogs } from "@/data/sampleDogs";

interface UserPreferences {
  livingSpace?: string;
  hasYard?: boolean;
  activityLevel?: string;
  hasKids?: boolean;
  hasPets?: boolean;
  sizePreference?: string;
}

interface UseChatBotOptions {
  onRecommendations?: (recommended: Dog[], explore: Dog[]) => void;
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
  "*wags tail excitedly* \n\nOh wow, a new friend! Hi hi hi! 🐾\n\nI'm Melon, a fluffy Australian Shepherd mix! I live here at the shelter with all my best buddies! We're all looking for our forever homes, and I LOVE helping my friends find their perfect humans!\n\n*tilts head curiously*\n\nSo tell me about where you live! Do you have a big yard I could... I mean, my friends could run around in?",
  [
    { id: "1", label: "🏠 House with a yard!", value: "house_yard" },
    { id: "2", label: "🏡 House, but no yard", value: "house_no_yard" },
    { id: "3", label: "🏢 An apartment", value: "apartment" },
  ]
);

export function useChatBot({ onRecommendations }: UseChatBotOptions = {}) {
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
          const hasYard = content.includes("yard");
          setPreferences((prev) => ({
            ...prev,
            livingSpace: content,
            hasYard,
          }));
          setStep(1);
          
          if (hasYard) {
            addBotMessage(
              "*ears perk up* \n\nA YARD?! Oh my goodness, some of my friends are gonna be SO excited about that! My buddy Bear does the biggest zoomies - he'd love all that space!\n\n*spins in a circle*\n\nOkay okay, I need to focus. Important question: How much do you like going on adventures? Like walks and runs and playing fetch?",
              [
                { id: "1", label: "🛋️ I prefer chill cuddle time", value: "low" },
                { id: "2", label: "⚖️ A nice balance of both!", value: "medium" },
                { id: "3", label: "🏃 I'm super active!", value: "high" },
              ]
            );
          } else {
            addBotMessage(
              "*nods understandingly*\n\nThat's totally okay! Lots of my friends do great in cozy spaces. Peanut actually prefers it - she says she can keep a better eye on her human that way! *giggles in dog*\n\nSo tell me, do you like lots of walks and playtime, or are you more of a Netflix-and-cuddle person?",
              [
                { id: "1", label: "🛋️ Cuddles all the way!", value: "low" },
                { id: "2", label: "⚖️ A bit of both!", value: "medium" },
                { id: "3", label: "🏃 Adventure time!", value: "high" },
              ]
            );
          }
          break;

        case 1:
          // Activity level
          setPreferences((prev) => ({ ...prev, activityLevel: content }));
          setStep(2);
          
          if (content === "low") {
            addBotMessage(
              "*settles down comfortably*\n\nOoooh, you sound like you'd get along great with Cinnamon! She's the BEST at naps. Sometimes we nap together and it's the coziest thing ever.\n\n*yawns just thinking about it*\n\nOh! Important thing - do you have any little humans at home? Like tiny ones that might want to pet us... a lot?",
              [
                { id: "1", label: "👶 Yes, I have kids!", value: "yes" },
                { id: "2", label: "🚫 Nope, no kiddos", value: "no" },
              ]
            );
          } else if (content === "high") {
            addBotMessage(
              "*bounces excitedly*\n\nYES! Another adventure human! Bear and Maple are gonna LOVE you! We play chase every day and it's the best thing EVER!\n\n*panting happily*\n\nOh oh oh, one more thing - any small humans in your pack? Some of my friends are extra gentle with kids!",
              [
                { id: "1", label: "👶 Yep, got little ones!", value: "yes" },
                { id: "2", label: "🚫 No kids here", value: "no" },
              ]
            );
          } else {
            addBotMessage(
              "*does a happy wiggle*\n\nBalance is good! Sometimes I want to run and play, and sometimes I just want belly rubs while my human watches TV. You get it!\n\nSpeaking of family... do you have any tiny humans? Kids, I think you call them?",
              [
                { id: "1", label: "👶 Yes, we have kids!", value: "yes" },
                { id: "2", label: "🚫 No children", value: "no" },
              ]
            );
          }
          break;

        case 2:
          // Kids
          const hasKids = content === "yes";
          setPreferences((prev) => ({ ...prev, hasKids }));
          setStep(3);
          
          if (hasKids) {
            addBotMessage(
              "*tail wags faster*\n\nOH I love kids! They give the BEST treats and scratches! Biscuit is especially good with little humans - she's so gentle and patient. Once a kid fell asleep on her and she didn't move for TWO HOURS!\n\n*looks around conspiratorially*\n\nPsst... do you have any other furry friends at home? Like... other dogs? Or even... *whispers* cats?",
              [
                { id: "1", label: "🐾 Yes, other pets!", value: "yes" },
                { id: "2", label: "🚫 No other pets", value: "no" },
              ]
            );
          } else {
            addBotMessage(
              "*nods thoughtfully*\n\nThat's cool! Some of my friends actually prefer being the only baby in the family - more treats and attention for them! *winks*\n\n*sniffs curiously*\n\nHey, do I smell other animals on you? Do you have other furry family members at home?",
              [
                { id: "1", label: "🐾 Yes, I have other pets!", value: "yes" },
                { id: "2", label: "🚫 Just me!", value: "no" },
              ]
            );
          }
          break;

        case 3:
          // Pets
          const hasPets = content === "yes";
          setPreferences((prev) => ({ ...prev, hasPets }));
          setStep(4);
          
          if (hasPets) {
            addBotMessage(
              "*sniffs excitedly*\n\nMore friends! I knew I smelled something! Don't worry, lots of us here at the shelter are great at making furry friends. Cinnamon even likes CATS! I know, I was shocked too.\n\n*sits down properly, trying to look professional*\n\nOkay, last question! What size friend are you looking for?",
              [
                { id: "1", label: "🐕 Pocket-sized (small)", value: "small" },
                { id: "2", label: "🐕‍🦺 Medium friend", value: "medium" },
                { id: "3", label: "🦮 Big ol' buddy (large)", value: "large" },
                { id: "4", label: "💕 Size doesn't matter!", value: "any" },
              ]
            );
          } else {
            addBotMessage(
              "*does a little spin*\n\nSo you'd be getting a FIRST fur baby! That's so exciting! You're gonna be the best pet parent, I can tell.\n\n*tries to sit still but tail keeps wagging*\n\nOkay okay, super important last question: What size doggo are you dreaming of?",
              [
                { id: "1", label: "🐕 Tiny and portable!", value: "small" },
                { id: "2", label: "🐕‍🦺 Medium is perfect", value: "medium" },
                { id: "3", label: "🦮 Big and huggable!", value: "large" },
                { id: "4", label: "💕 I'll love any size!", value: "any" },
              ]
            );
          }
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
          
          // Get explore dogs (dogs not in recommendations)
          const explorePool = sampleDogs.filter(d => !matches.find(m => m.id === d.id));
          const explore = explorePool.slice(0, 5);
          
          // Notify about recommendations
          onRecommendations?.(matches.slice(0, 10), explore);

          if (matches.length > 0) {
            const dogIntros = matches.slice(0, 10).map((d) => {
              const intros: Record<string, string> = {
                "Biscuit": "Biscuit (she gives the BEST cuddles!)",
                "Mochi": "Mochi (she's so adventurous!)",
                "Cinnamon": "Cinnamon (the nap queen 👑)",
                "Peanut": "Peanut (tiny but FIERCE with love)",
                "Bear": "Bear (the biggest teddy bear ever!)",
                "Maple": "Maple (that fluffy butt tho!)",
              };
              return intros[d.name] || d.name;
            }).join(", ");

            addBotMessage(
              `*jumps up and down excitedly*\n\nOMG OMG OMG! I know EXACTLY who you need to meet!\n\n🌟 ${dogIntros}\n\n*runs in circles*\n\nThey're all gonna be SO happy! Go check out their profiles - I told them all about you and they can't wait!\n\nClick "Browse Dogs" and look for my friends! And don't forget to tap the heart if you like them - it makes them SO happy! 💕`,
              [
                { id: "1", label: "🔍 Meet your friends!", value: "browse" },
                { id: "2", label: "🔄 Let's start over", value: "restart" },
              ]
            );
          } else {
            addBotMessage(
              `*tilts head*\n\nHmm, I'm having trouble thinking of the perfect match right now... BUT! You should still come meet everyone! Sometimes the best friendships are the ones you don't expect.\n\n*gives puppy eyes*\n\nMy friend Biscuit always says "Every dog deserves a chance to make a friend." Will you come meet us?`,
              [
                { id: "1", label: "🔍 Meet everyone!", value: "browse" },
                { id: "2", label: "🔄 Try different answers", value: "restart" },
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
              `*happy panting*\n\nYay! Go meet my friends! They're all waiting in the "Browse Dogs" section!\n\nAnd hey... *looks at you with big puppy eyes* ...even if you don't find your match today, will you come visit us again? We love making new friends!\n\n*wags tail hopefully*`,
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
