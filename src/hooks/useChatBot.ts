import { useState, useCallback } from "react";
import { ChatMessage, ChatOption, Dog } from "@/types/dog";
import { sampleDogs } from "@/data/sampleDogs";

interface UserPreferences {
  // Household & location
  location?: string;
  hasChildren?: boolean;
  childrenAges?: string;
  hasOtherPets?: boolean;
  petTypes?: string;
  
  // Home & environment
  homeType?: string;
  hasFencedYard?: boolean;
  neighborhoodNoise?: string;
  
  // Lifestyle & activity
  activityLevel?: string;
  hoursAlone?: string;
  
  // Dog traits
  sizePreference?: string;
  agePreference?: string;
  genderPreference?: string;
  
  // Safety & compatibility
  needsGoodWithKids?: boolean;
  needsGoodWithDogs?: boolean;
  needsGoodWithCats?: boolean;
  hasAllergies?: boolean;
  trainingPreference?: string;
  
  // Health & support
  openToSpecialNeeds?: boolean;
  requiresVaccinated?: boolean;
}

interface HistoryEntry {
  step: number;
  preferences: UserPreferences;
  messages: ChatMessage[];
}

interface UseChatBotOptions {
  onRecommendations?: (recommended: Dog[], explore: Dog[]) => void;
}

// Questions that can be skipped (optional)
const SKIPPABLE_STEPS = [7, 8, 9, 10, 11, 12, 13]; // size, age, gender, allergies, training, special needs, vaccination

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

const addNavigationOptions = (options: ChatOption[], step: number, canGoBack: boolean): ChatOption[] => {
  const navOptions: ChatOption[] = [...options];
  
  // Add skip option for all questions (non-skippable ones will show warning first)
  if (step > 0 && step < 14) {
    navOptions.push({ id: "skip", label: "⏭️ Skip this question", value: "skip" });
  }
  
  if (canGoBack && step > 0) {
    navOptions.push({ id: "back", label: "⬅️ Go back", value: "back" });
  }
  
  return navOptions;
};

const initialMessage = createMessage(
  "bot",
  "*wags tail excitedly* \n\nOh wow, a new friend! Hi hi hi! 🐾\n\nI'm Melon, a fluffy Australian Shepherd mix! I live here at the shelter with all my best buddies! We're all looking for our forever homes, and I LOVE helping my friends find their perfect humans!\n\n*tilts head curiously*\n\nFirst things first - where do you live? This helps me know which of my friends might be nearby!",
  [
    { id: "1", label: "🏙️ Big city life", value: "city" },
    { id: "2", label: "🏘️ Suburbs", value: "suburbs" },
    { id: "3", label: "🌾 Rural/countryside", value: "rural" },
  ]
);

export function useChatBot({ onRecommendations }: UseChatBotOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [isTyping, setIsTyping] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [skipWarnings, setSkipWarnings] = useState<Set<number>>(new Set()); // Tracks steps where user was warned about skipping

  const addBotMessage = useCallback((content: string, options?: ChatOption[], nextStep?: number) => {
    setIsTyping(true);
    setTimeout(() => {
      const finalOptions = nextStep !== undefined 
        ? addNavigationOptions(options || [], nextStep, history.length > 0 || step > 0)
        : options;
      setMessages((prev) => [...prev, createMessage("bot", content, finalOptions)]);
      setIsTyping(false);
    }, 1000 + Math.random() * 500);
  }, [history.length, step]);

  const getRecommendations = useCallback((prefs: UserPreferences) => {
    return sampleDogs.filter((dog) => {
      if (prefs.sizePreference && prefs.sizePreference !== "any") {
        if (prefs.sizePreference === "small" && dog.size !== "small") return false;
        if (prefs.sizePreference === "large" && dog.size === "small") return false;
      }
      if (prefs.needsGoodWithKids && !dog.goodWithKids) return false;
      if (prefs.needsGoodWithDogs && !dog.goodWithPets) return false;
      if (prefs.needsGoodWithCats && !dog.goodWithPets) return false;
      if (prefs.activityLevel === "low" && dog.energyLevel === "high") return false;
      if (prefs.activityLevel === "high" && dog.energyLevel === "low") return false;
      return true;
    });
  }, []);

  const saveHistory = useCallback(() => {
    setHistory((prev) => [...prev, { step, preferences: { ...preferences }, messages: [...messages] }]);
  }, [step, preferences, messages]);

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    
    const lastEntry = history[history.length - 1];
    setStep(lastEntry.step);
    setPreferences(lastEntry.preferences);
    setMessages(lastEntry.messages);
    setHistory((prev) => prev.slice(0, -1));
  }, [history]);

  const handleUserMessage = useCallback(
    (content: string) => {
      // Handle back navigation
      if (content === "back") {
        goBack();
        return;
      }

      // Handle skip - treat as "no preference" / undefined
      const isSkipping = content === "skip" || content.toLowerCase() === "skip";
      
      // Check if user is trying to skip an important (non-skippable) question
      if (isSkipping && !SKIPPABLE_STEPS.includes(step)) {
        // Check if they've already been warned for this step
        if (!skipWarnings.has(step)) {
          // First attempt - warn them
          setMessages((prev) => [...prev, createMessage("user", "Skip")]);
          setSkipWarnings((prev) => new Set(prev).add(step));
          addBotMessage(
            "*tilts head with a concerned look*\n\nOh, this question is really important for me to find you the best matches! 🐾 I'd recommend answering it if you can.\n\nBut if you really need to skip, just say 'skip' again and I'll understand!",
            messages[messages.length - 1]?.options?.filter(opt => opt.value !== "skip" && opt.value !== "back") || []
          );
          return;
        }
        // Second attempt - allow skip and reset warning
        setSkipWarnings((prev) => {
          const newSet = new Set(prev);
          newSet.delete(step);
          return newSet;
        });
      }
      
      setMessages((prev) => [...prev, createMessage("user", isSkipping ? "Skip" : content)]);
      
      // Save current state to history before advancing
      saveHistory();

      switch (step) {
        case 0:
          // Location
          if (!isSkipping) setPreferences((prev) => ({ ...prev, location: content }));
          setStep(1);
          addBotMessage(
            "*perks ears up*\n\nOoh nice! Now here's a big question - do you have any little humans running around at home? You know, kids?",
            [
              { id: "1", label: "👶 Yes, young kids (under 8)", value: "young_kids" },
              { id: "2", label: "🧒 Yes, older kids (8+)", value: "older_kids" },
              { id: "3", label: "🚫 No kiddos", value: "no_kids" },
            ],
            1
          );
          break;

        case 1: {
          // Children
          if (!isSkipping) {
            const hasChildren = content !== "no_kids";
            const childrenAges = content === "young_kids" ? "under_8" : content === "older_kids" ? "8_plus" : undefined;
            setPreferences((prev) => ({ 
              ...prev, 
              hasChildren,
              childrenAges,
              needsGoodWithKids: content === "young_kids"
            }));
          }
          setStep(2);
          addBotMessage(
            "*sniffs curiously*\n\nOoh ooh, very important question! Do you have any other furry (or not-so-furry) friends at home already?",
            [
              { id: "1", label: "🐕 Yes, other dog(s)", value: "dogs" },
              { id: "2", label: "🐱 Yes, cat(s)", value: "cats" },
              { id: "3", label: "🐾 Yes, both dogs and cats", value: "both" },
              { id: "4", label: "🚫 No other pets", value: "none" },
            ],
            2
          );
          break;
        }

        case 2: {
          // Other pets
          if (!isSkipping) {
            const hasOtherPets = content !== "none";
            setPreferences((prev) => ({ 
              ...prev, 
              hasOtherPets,
              petTypes: content,
              needsGoodWithDogs: content === "dogs" || content === "both",
              needsGoodWithCats: content === "cats" || content === "both"
            }));
          }
          setStep(3);
          addBotMessage(
            "*does a little spin*\n\nNow tell me about your den! What type of home do you have?",
            [
              { id: "1", label: "🏢 Apartment/Condo", value: "apartment" },
              { id: "2", label: "🏠 House", value: "house" },
              { id: "3", label: "🏡 Townhouse", value: "townhouse" },
            ],
            3
          );
          break;
        }

        case 3:
          // Home type
          if (!isSkipping) setPreferences((prev) => ({ ...prev, homeType: content }));
          setStep(4);
          
          if (content === "apartment") {
            addBotMessage(
              "*nods understandingly*\n\nCozy spaces can be great! Some of my friends actually prefer apartments - less space to patrol means more nap time! *giggles*\n\nIs your building generally quiet or pretty busy with noise?",
              [
                { id: "1", label: "🤫 Nice and quiet", value: "quiet" },
                { id: "2", label: "📢 Pretty busy/noisy", value: "noisy" },
                { id: "3", label: "⚖️ Somewhere in between", value: "moderate" },
              ],
              4
            );
          } else {
            addBotMessage(
              "*tail wags faster*\n\nOoh a house! Do you have a fenced yard? Some of my friends LOVE having a yard to do zoomies in!",
              [
                { id: "1", label: "🏡 Yes, fully fenced!", value: "fenced" },
                { id: "2", label: "🌿 Yard but not fenced", value: "unfenced" },
                { id: "3", label: "🚫 No yard", value: "no_yard" },
              ],
              4
            );
          }
          break;

        case 4:
          // Yard or noise level
          if (!isSkipping) {
            if (preferences.homeType === "apartment") {
              setPreferences((prev) => ({ ...prev, neighborhoodNoise: content }));
            } else {
              setPreferences((prev) => ({ 
                ...prev, 
                hasFencedYard: content === "fenced"
              }));
            }
          }
          setStep(5);
          addBotMessage(
            "*settles down to listen carefully*\n\nOkay, super important question! How active do you want your new best friend to be?",
            [
              { id: "1", label: "🛋️ Couch potato buddy", value: "low" },
              { id: "2", label: "🚶 Moderate walks & play", value: "medium" },
              { id: "3", label: "🏃 High energy - running/hiking!", value: "high" },
            ],
            5
          );
          break;

        case 5:
          // Activity level
          if (!isSkipping) setPreferences((prev) => ({ ...prev, activityLevel: content }));
          setStep(6);
          addBotMessage(
            "*tilts head thoughtfully*\n\nHow many hours will your new friend be alone on a typical weekday? Some of us get lonely easily... *puppy eyes*",
            [
              { id: "1", label: "🏠 Less than 4 hours", value: "less_4" },
              { id: "2", label: "⏰ 4-8 hours", value: "4_to_8" },
              { id: "3", label: "😴 More than 8 hours", value: "more_8" },
            ],
            6
          );
          break;

        case 6:
          // Hours alone
          if (!isSkipping) setPreferences((prev) => ({ ...prev, hoursAlone: content }));
          setStep(7);
          addBotMessage(
            "*bounces excitedly*\n\nNow the fun part! What size doggo are you dreaming of?",
            [
              { id: "1", label: "🐕 Extra Small (under 10 lbs)", value: "xs" },
              { id: "2", label: "🐕 Small (10-25 lbs)", value: "small" },
              { id: "3", label: "🐕‍🦺 Medium (25-50 lbs)", value: "medium" },
              { id: "4", label: "🦮 Large (50-80 lbs)", value: "large" },
              { id: "5", label: "🐻 Extra Large (80+ lbs)", value: "xl" },
              { id: "6", label: "💕 No preference!", value: "any" },
            ],
            7
          );
          break;

        case 7:
          // Size preference
          if (!isSkipping) setPreferences((prev) => ({ ...prev, sizePreference: content === "any" ? undefined : content }));
          setStep(8);
          addBotMessage(
            "*wags tail*\n\nDo you have an age preference? Puppies are adorable but need LOTS of work. Seniors like to nap with you!",
            [
              { id: "1", label: "🐶 Puppy (under 1 year)", value: "puppy" },
              { id: "2", label: "🐕 Young (1-3 years)", value: "young" },
              { id: "3", label: "🐕‍🦺 Adult (3-7 years)", value: "adult" },
              { id: "4", label: "👴 Senior (7+ years)", value: "senior" },
              { id: "5", label: "💕 No preference!", value: "any" },
            ],
            8
          );
          break;

        case 8:
          // Age preference
          if (!isSkipping) setPreferences((prev) => ({ ...prev, agePreference: content === "any" ? undefined : content }));
          setStep(9);
          addBotMessage(
            "*curious head tilt*\n\nDo you have a gender preference for your new friend?",
            [
              { id: "1", label: "♂️ Male", value: "male" },
              { id: "2", label: "♀️ Female", value: "female" },
              { id: "3", label: "💕 No preference!", value: "any" },
            ],
            9
          );
          break;

        case 9:
          // Gender preference
          if (!isSkipping) setPreferences((prev) => ({ ...prev, genderPreference: content === "any" ? undefined : content }));
          setStep(10);
          addBotMessage(
            "*sneezes cutely*\n\nDoes anyone in your home have dog allergies? Some of my friends are more hypoallergenic than others!",
            [
              { id: "1", label: "🤧 Yes, we have allergies", value: "yes" },
              { id: "2", label: "✨ Nope, no allergies!", value: "no" },
            ],
            10
          );
          break;

        case 10:
          // Allergies
          if (!isSkipping) setPreferences((prev) => ({ ...prev, hasAllergies: content === "yes" }));
          setStep(11);
          addBotMessage(
            "*sits up straight trying to look professional*\n\nHow about training? Are you okay with a dog that still needs some house-training and leash work, or would you prefer one who's already got the basics down?",
            [
              { id: "1", label: "🎓 Already trained please!", value: "trained" },
              { id: "2", label: "📚 Some training needed is fine", value: "some_training" },
              { id: "3", label: "🐾 I'm happy to train from scratch!", value: "needs_training" },
            ],
            11
          );
          break;

        case 11:
          // Training preference
          if (!isSkipping) setPreferences((prev) => ({ ...prev, trainingPreference: content }));
          setStep(12);
          addBotMessage(
            "*gentle tail wag*\n\nSome of my friends here have special medical needs or disabilities. They're just as loveable! Are you open to considering them?",
            [
              { id: "1", label: "💕 Yes, I'm open to special needs", value: "yes" },
              { id: "2", label: "🚫 Prefer no special needs", value: "no" },
              { id: "3", label: "🤔 Depends on the situation", value: "maybe" },
            ],
            12
          );
          break;

        case 12:
          // Special needs
          if (!isSkipping) setPreferences((prev) => ({ ...prev, openToSpecialNeeds: content === "yes" || content === "maybe" }));
          setStep(13);
          addBotMessage(
            "*final excited wiggle*\n\nLast question! Would you like to only see dogs who are already spayed/neutered and up-to-date on vaccines?",
            [
              { id: "1", label: "✅ Yes, only fully vaccinated", value: "yes" },
              { id: "2", label: "🚫 Doesn't matter to me", value: "no" },
            ],
            13
          );
          break;

        case 13: {
          // Vaccination preference & show results
          const finalPrefs = {
            ...preferences,
            requiresVaccinated: isSkipping ? undefined : content === "yes",
          };
          setPreferences(finalPrefs);
          setStep(14);

          const matches = getRecommendations(finalPrefs);
          
          // Get explore dogs (dogs not in recommendations)
          const explorePool = sampleDogs.filter(d => !matches.find(m => m.id === d.id));
          const explore = explorePool.slice(0, 5);
          
          // Notify about recommendations
          onRecommendations?.(matches.slice(0, 10), explore);

          if (matches.length > 0) {
            const dogNames = matches.slice(0, 5).map(d => d.name).join(", ");

            addBotMessage(
              `*jumps up and down excitedly*\n\nOMG OMG OMG! I found some AMAZING matches for you!\n\n🌟 Based on everything you told me, I think you'd love: ${dogNames}${matches.length > 5 ? ` and ${matches.length - 5} more friends!` : '!'}\n\n*runs in circles*\n\nThey're all gonna be SO happy! Go check out their profiles - I told them all about you and they can't wait!\n\nClick "Browse Dogs" to meet them! And don't forget to tap the heart if you like them - it makes them SO happy! 💕`,
              [
                { id: "1", label: "🔍 Meet your matches!", value: "browse" },
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
        }

        case 14:
          // Final interactions
          if (content === "restart" || content.toLowerCase().includes("start over")) {
            setPreferences({});
            setStep(0);
            setHistory([]);
            setSkipWarnings(new Set());
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
    [step, preferences, addBotMessage, getRecommendations, onRecommendations, saveHistory, goBack, skipWarnings, messages]
  );

  const totalSteps = 14;
  const currentStep = Math.min(step + 1, totalSteps);

  return {
    messages,
    isTyping,
    handleUserMessage,
    currentStep,
    totalSteps,
  };
}
