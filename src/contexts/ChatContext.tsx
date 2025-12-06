import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { ChatMessage, ChatOption, Dog } from "@/types/dog";
import { sampleDogs } from "@/data/sampleDogs";
import { matchDogs, PreferencePayload, RecommendRequest, RecommendResponse, RecommendResult, ApiError } from "@/lib/api";

interface UserPreferences {
  state?: string;
  location?: string;
  hasChildren?: boolean;
  childrenAges?: string;
  hasOtherPets?: boolean;
  petTypes?: string;
  homeType?: string;
  hasFencedYard?: boolean;
  neighborhoodNoise?: string;
  activityLevel?: string;
  hoursAlone?: string;
  sizePreference?: string[]; // Now an array for multi-select
  agePreference?: string[];  // Now an array for multi-select
  genderPreference?: string;
  needsGoodWithKids?: boolean;
  needsGoodWithDogs?: boolean;
  needsGoodWithCats?: boolean;
  hasAllergies?: boolean;
  trainingPreference?: string;
  openToSpecialNeeds?: boolean;
  requiresVaccinated?: boolean;
}

// Helper to parse multi-select values (comma-separated or "any")
const parseMultiSelect = (value: string): string[] | undefined => {
  if (value === "any" || value === "skip") return undefined;
  return value.split(",").filter(v => v.trim());
};

const toSizeCodes = (sizes?: string[]) => {
  if (!sizes || sizes.length === 0) return undefined;
  const map: Record<string, string> = {
    xs: "XS",
    small: "S",
    medium: "M",
    large: "L",
    xl: "XL",
  };
  return sizes.map((s) => map[s] || s.toUpperCase());
};

const toAgeGroups = (ages?: string[]) => {
  if (!ages || ages.length === 0) return undefined;
  const map: Record<string, string> = {
    puppy: "Puppy",
    young: "Young",
    adult: "Adult",
    senior: "Senior",
  };
  return ages.map((age) => map[age] || age);
};

const bucketEnergy = (value: unknown): "low" | "medium" | "high" | undefined => {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower.includes("low")) return "low";
    if (lower.includes("high")) return "high";
    if (lower.includes("medium") || lower.includes("moderate")) return "medium";
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return undefined;
  if (num <= 3) return "low";
  if (num <= 6) return "medium";
  return "high";
};

const mapApiDogToDog = (result: RecommendResult): Dog => {
  const dog = result.dog_data || {};
  const sizeMap: Record<string, "small" | "medium" | "large"> = {
    XS: "small",
    S: "small",
    Small: "small",
    M: "medium",
    Medium: "medium",
    L: "large",
    Large: "large",
    XL: "large",
  };

  const sizeValue = sizeMap[String(dog.size || "")] || "medium";
  const energyValue = bucketEnergy(dog.energy_level) || "medium";
  const description = (dog.description_html as string | undefined)?.replace(/<[^>]+>/g, "") ||
    (dog.description as string | undefined) ||
    "This sweet pup is looking for a loving home!";
  const breed =
    (dog.breed_text as string | undefined) ||
    (dog.breed_primary as string | undefined) ||
    (dog.breed_secondary as string | undefined) ||
    "Mixed Breed";
  const age =
    (dog.age_text as string | undefined) ||
    (dog.age_group as string | undefined) ||
    (dog.age_years !== undefined ? `${dog.age_years} years` : "Age unknown");
  const traits: string[] = [];
  if (dog.good_with_kids) traits.push("Kid friendly");
  if (dog.good_with_dogs) traits.push("Dog friendly");
  if (dog.good_with_cats) traits.push("Cat friendly");
  if (dog.house_trained) traits.push("House trained");
  if (dog.hypoallergenic) traits.push("Hypoallergenic");
  if (dog.special_needs) traits.push("Special needs");
  if (dog.needs_foster) traits.push("Needs foster");
  if (Array.isArray(dog.tags)) {
    (dog.tags as string[]).slice(0, 4).forEach((tag) => traits.push(tag));
  }

  const imageUrl =
    (dog.primary_photo_url as string | undefined) ||
    (Array.isArray(dog.photo_urls) ? (dog.photo_urls as string[])[0] : undefined) ||
    "/placeholder.svg";

  // Get additional photos (excluding the primary one)
  const photoUrls = Array.isArray(dog.photo_urls)
    ? (dog.photo_urls as string[]).filter((url) => url !== imageUrl)
    : undefined;

  const shelterUrl = (dog.url as string | undefined) || 
    (dog.shelter_url as string | undefined) ||
    (dog.petfinder_url as string | undefined);

  return {
    id: result.dog_id,
    name: (dog.name as string | undefined) || result.name || "Sweet pup",
    breed,
    age,
    size: sizeValue,
    energyLevel: energyValue,
    goodWithKids: Boolean(dog.good_with_kids),
    goodWithPets: Boolean(dog.good_with_dogs || dog.good_with_cats),
    description,
    imageUrl,
    photoUrls,
    shelterUrl,
    traits: traits.slice(0, 6),
  };
};

const buildPayloadFromPreferences = (prefs: UserPreferences): RecommendRequest => {
  const preferences: PreferencePayload[] = [];
  const hardFilters: Record<string, unknown> = {};

  const addPref = (
    field: string,
    hardness: "must" | "strong" | "nice",
    value: unknown,
    opts: { weight?: number; allowUnknown?: boolean } = {}
  ) => {
    preferences.push({
      field,
      hardness,
      value,
      weight: opts.weight,
      allow_unknown: opts.allowUnknown ?? true,
    });
  };

  if (prefs.state) {
    hardFilters.location_state = prefs.state.toUpperCase();
  }
  if (prefs.location) {
    hardFilters.location_label = prefs.location;
  }

  // Must-have safety/compatibility
  if (prefs.needsGoodWithKids) addPref("good_with_kids", "must", true, { allowUnknown: false });
  if (prefs.needsGoodWithDogs) addPref("good_with_dogs", "must", true, { allowUnknown: false });
  if (prefs.needsGoodWithCats) addPref("good_with_cats", "must", true, { allowUnknown: false });
  if (prefs.openToSpecialNeeds === false) addPref("special_needs", "must", false, { allowUnknown: false });
  if (prefs.requiresVaccinated) {
    addPref("vaccinations_up_to_date", "must", true, { allowUnknown: false });
    addPref("spayed_neutered", "must", true, { allowUnknown: false });
  }

  // Preferences (strong/nice)
  const sizeCodes = toSizeCodes(prefs.sizePreference);
  if (sizeCodes) {
    sizeCodes.forEach((size) => addPref("size", "nice", size));
  }

  const ageGroups = toAgeGroups(prefs.agePreference);
  if (ageGroups) {
    ageGroups.forEach((age) => addPref("age_group", "nice", age));
  }

  if (prefs.genderPreference) {
    const gender = prefs.genderPreference === "male" ? "Male" : prefs.genderPreference === "female" ? "Female" : prefs.genderPreference;
    addPref("sex", "nice", gender);
  }

  if (prefs.activityLevel) {
    const target = prefs.activityLevel === "low" ? 2 : prefs.activityLevel === "high" ? 8 : 5;
    addPref("energy_level", "nice", target, { weight: 0.5 });
  }

  if (prefs.homeType === "apartment") {
    addPref("apartment_ok", "strong", true);
  } else if (prefs.hasFencedYard) {
    addPref("requires_fenced_yard", "nice", true);
  }

  if (prefs.hasAllergies) {
    addPref("hypoallergenic", "strong", true);
  }

  if (prefs.trainingPreference === "trained") {
    addPref("house_trained", "strong", true);
  }

  return {
    hard_filters: hardFilters,
    preferences,
    seen_dog_ids: [],
  };
};

interface HistoryEntry {
  step: number;
  preferences: UserPreferences;
  messages: ChatMessage[];
}

const SKIPPABLE_STEPS = [8, 9, 10, 11, 12, 13, 14];
const TRI_STATE_AREA = ["ny", "new york", "nj", "new jersey", "ct", "connecticut"];

const createMessage = (
  role: "user" | "bot",
  content: string,
  options?: ChatOption[]
): ChatMessage => ({
  id: crypto.randomUUID(),
  content,
  role,
  timestamp: new Date(),
  options,
});

const addNavigationOptions = (options: ChatOption[], step: number, canGoBack: boolean): ChatOption[] => {
  const navOptions: ChatOption[] = [...options];
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
  "*wags tail excitedly* \n\nOh wow, a new friend! Hi hi hi! 🐾\n\nI'm Melon, a fluffy Australian Shepherd mix! I live here at the shelter with all my best buddies! We're all looking for our forever homes, and I LOVE helping my friends find their perfect humans!\n\n*tilts head curiously*\n\nFirst things first - what state do you live in?",
  [
    { id: "1", label: "🗽 New York", value: "ny" },
    { id: "2", label: "🏙️ New Jersey", value: "nj" },
    { id: "3", label: "🌲 Connecticut", value: "ct" },
    { id: "4", label: "📍 Other state", value: "other" },
  ]
);

interface ChatContextType {
  messages: ChatMessage[];
  isTyping: boolean;
  currentStep: number;
  totalSteps: number;
  handleUserMessage: (content: string) => void;
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ 
  children, 
  onRecommendations 
}: { 
  children: ReactNode;
  onRecommendations?: (recommended: Dog[], explore: Dog[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [isTyping, setIsTyping] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [skipWarnings, setSkipWarnings] = useState<Set<number>>(new Set());

  const totalSteps = 15;

  const addBotMessage = useCallback((content: string, options?: ChatOption[], nextStep?: number) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => {
        const finalOptions = nextStep !== undefined 
          ? addNavigationOptions(options || [], nextStep, history.length > 0 || step > 0)
          : options;
        return [...prev, createMessage("bot", content, finalOptions)];
      });
      setIsTyping(false);
    }, 1000 + Math.random() * 500);
  }, [history.length, step]);

  const getRecommendations = useCallback((prefs: UserPreferences) => {
    return sampleDogs.filter((dog) => {
      // Size filtering with array support
      if (prefs.sizePreference && prefs.sizePreference.length > 0) {
        // Map dog sizes to our selection values
        const sizeMap: Record<string, string[]> = {
          "small": ["xs", "small"],
          "medium": ["medium"],
          "large": ["large", "xl"]
        };
        const dogSizeValues = sizeMap[dog.size] || [];
        const hasMatchingSize = prefs.sizePreference.some(s => dogSizeValues.includes(s));
        if (!hasMatchingSize) return false;
      }
      
      // Age filtering is not implemented in sampleDogs yet, but structure is ready
      // if (prefs.agePreference && prefs.agePreference.length > 0) { ... }
      
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

  const resetChat = useCallback(() => {
    setMessages([initialMessage]);
    setPreferences({});
    setStep(0);
    setHistory([]);
    setSkipWarnings(new Set());
  }, []);

  const handleUserMessage = useCallback(
    async (content: string) => {
      if (content === "back") {
        goBack();
        return;
      }

      // Handle restart commands
      const restartCommands = ["restart", "try again", "start over", "reset"];
      if (content === "restart_chat" || restartCommands.includes(content.toLowerCase().trim())) {
        resetChat();
        return;
      }

      const isSkipping = content === "skip" || content.toLowerCase() === "skip";
      
      if (isSkipping && !SKIPPABLE_STEPS.includes(step)) {
        if (!skipWarnings.has(step)) {
          setMessages((prev) => [...prev, createMessage("user", "Skip")]);
          setSkipWarnings((prev) => new Set(prev).add(step));
          addBotMessage(
            "*tilts head with a concerned look*\n\nOh, this question is really important for me to find you the best matches! 🐾 I'd recommend answering it if you can.\n\nBut if you really need to skip, just say 'skip' again and I'll understand!",
            messages[messages.length - 1]?.options?.filter(opt => opt.value !== "skip" && opt.value !== "back") || []
          );
          return;
        }
        setSkipWarnings((prev) => {
          const newSet = new Set(prev);
          newSet.delete(step);
          return newSet;
        });
      }
      
      setMessages((prev) => [...prev, createMessage("user", isSkipping ? "Skip" : content)]);
      saveHistory();

      switch (step) {
        case 0: {
          const isTriState = TRI_STATE_AREA.includes(content.toLowerCase()) || 
                            ["ny", "nj", "ct"].includes(content.toLowerCase());
          
          if (!isTriState && content !== "skip") {
            // Not in tri-state area - end conversation
            addBotMessage(
              "*ears droop sadly*\n\nOh no... 😢 I'm so sorry, but right now we're only working with shelters in the New York tri-state area (NY, NJ, CT).\n\n*hopeful tail wag*\n\nBut don't worry! We're hoping to expand soon. Check back later, and maybe I'll be able to help you find a furry friend near you!",
              [
                { id: "restart", label: "🔄 Start over", value: "restart_chat" },
              ]
            );
            return;
          }
          
          if (!isSkipping) setPreferences((prev) => ({ ...prev, state: content }));
          setStep(1);
          addBotMessage(
            "*perks ears up*\n\nPawsome! You're in our area! 🎉\n\nNow tell me - where do you live? This helps me know which of my friends might be nearby!",
            [
              { id: "1", label: "🏙️ Big city life", value: "city" },
              { id: "2", label: "🏘️ Suburbs", value: "suburbs" },
              { id: "3", label: "🌾 Rural/countryside", value: "rural" },
            ],
            1
          );
          break;
        }

        case 1:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, location: content }));
          setStep(2);
          addBotMessage(
            "*perks ears up*\n\nOoh nice! Now here's a big question - do you have any little humans running around at home? You know, kids?",
            [
              { id: "1", label: "👶 Yes, young kids (under 8)", value: "young_kids" },
              { id: "2", label: "🧒 Yes, older kids (8+)", value: "older_kids" },
              { id: "3", label: "🚫 No kiddos", value: "no_kids" },
            ],
            2
          );
          break;

        case 2: {
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
          setStep(3);
          addBotMessage(
            "*sniffs curiously*\n\nOoh ooh, very important question! Do you have any other furry (or not-so-furry) friends at home already?",
            [
              { id: "1", label: "🐕 Yes, other dog(s)", value: "dogs" },
              { id: "2", label: "🐱 Yes, cat(s)", value: "cats" },
              { id: "3", label: "🐾 Yes, both dogs and cats", value: "both" },
              { id: "4", label: "🚫 No other pets", value: "none" },
            ],
            3
          );
          break;
        }

        case 3: {
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
          setStep(4);
          addBotMessage(
            "*does a little spin*\n\nNow tell me about your den! What type of home do you have?",
            [
              { id: "1", label: "🏢 Apartment/Condo", value: "apartment" },
              { id: "2", label: "🏠 House", value: "house" },
              { id: "3", label: "🏡 Townhouse", value: "townhouse" },
            ],
            4
          );
          break;
        }

        case 4:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, homeType: content }));
          setStep(5);
          
          if (content === "apartment") {
            addBotMessage(
              "*nods understandingly*\n\nCozy spaces can be great! Some of my friends actually prefer apartments - less space to patrol means more nap time! *giggles*\n\nIs your building generally quiet or pretty busy with noise?",
              [
                { id: "1", label: "🤫 Nice and quiet", value: "quiet" },
                { id: "2", label: "📢 Pretty busy/noisy", value: "noisy" },
                { id: "3", label: "⚖️ Somewhere in between", value: "moderate" },
              ],
              5
            );
          } else {
            addBotMessage(
              "*tail wags faster*\n\nOoh a house! Do you have a fenced yard? Some of my friends LOVE having a yard to do zoomies in!",
              [
                { id: "1", label: "🏡 Yes, fully fenced!", value: "fenced" },
                { id: "2", label: "🌿 Yard but not fenced", value: "unfenced" },
                { id: "3", label: "🚫 No yard", value: "no_yard" },
              ],
              5
            );
          }
          break;

        case 5:
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
          setStep(6);
          addBotMessage(
            "*settles down to listen carefully*\n\nOkay, super important question! How active do you want your new best friend to be?",
            [
              { id: "1", label: "🛋️ Couch potato buddy", value: "low" },
              { id: "2", label: "🚶 Moderate walks & play", value: "medium" },
              { id: "3", label: "🏃 High energy - running/hiking!", value: "high" },
            ],
            6
          );
          break;

        case 6:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, activityLevel: content }));
          setStep(7);
          addBotMessage(
            "*tilts head thoughtfully*\n\nHow many hours will your new friend be alone on a typical weekday? Some of us get lonely easily... *puppy eyes*",
            [
              { id: "1", label: "🏠 Less than 4 hours", value: "less_4" },
              { id: "2", label: "⏰ 4-8 hours", value: "4_to_8" },
              { id: "3", label: "😴 More than 8 hours", value: "more_8" },
            ],
            7
          );
          break;

        case 7:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, hoursAlone: content }));
          setStep(8);
          addBotMessage(
            "*bounces excitedly*\n\nNow the fun part! What size doggo are you dreaming of?\n\n✨ You can pick multiple sizes! Selecting all = No preference!",
            [
              { id: "1", label: "🐕 Extra Small (under 10 lbs)", value: "xs", multiSelect: true },
              { id: "2", label: "🐕 Small (10-25 lbs)", value: "small", multiSelect: true },
              { id: "3", label: "🐕‍🦺 Medium (25-50 lbs)", value: "medium", multiSelect: true },
              { id: "4", label: "🦮 Large (50-80 lbs)", value: "large", multiSelect: true },
              { id: "5", label: "🐻 Extra Large (80+ lbs)", value: "xl", multiSelect: true },
            ],
            8
          );
          break;

        case 8:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, sizePreference: parseMultiSelect(content) }));
          setStep(9);
          addBotMessage(
            "*wags tail*\n\nDo you have an age preference? Puppies are adorable but need LOTS of work. Seniors like to nap with you!\n\n✨ You can pick multiple ages! Selecting all = No preference!",
            [
              { id: "1", label: "🐶 Puppy (under 1 year)", value: "puppy", multiSelect: true },
              { id: "2", label: "🐕 Young (1-3 years)", value: "young", multiSelect: true },
              { id: "3", label: "🐕‍🦺 Adult (3-7 years)", value: "adult", multiSelect: true },
              { id: "4", label: "👴 Senior (7+ years)", value: "senior", multiSelect: true },
            ],
            9
          );
          break;

        case 9:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, agePreference: parseMultiSelect(content) }));
          setStep(10);
          addBotMessage(
            "*curious head tilt*\n\nDo you have a gender preference for your new friend?",
            [
              { id: "1", label: "♂️ Male", value: "male" },
              { id: "2", label: "♀️ Female", value: "female" },
              { id: "3", label: "💕 No preference!", value: "any" },
            ],
            10
          );
          break;

        case 10:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, genderPreference: content === "any" ? undefined : content }));
          setStep(11);
          addBotMessage(
            "*sneezes cutely*\n\nDoes anyone in your home have dog allergies? Some of my friends are more hypoallergenic than others!",
            [
              { id: "1", label: "🤧 Yes, we have allergies", value: "yes" },
              { id: "2", label: "✨ Nope, no allergies!", value: "no" },
            ],
            11
          );
          break;

        case 11:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, hasAllergies: content === "yes" }));
          setStep(12);
          addBotMessage(
            "*sits up straight trying to look professional*\n\nHow about training? Are you okay with a dog that still needs some house-training and leash work, or would you prefer one who's already got the basics down?",
            [
              { id: "1", label: "🎓 Already trained please!", value: "trained" },
              { id: "2", label: "📚 Some training needed is fine", value: "some_training" },
              { id: "3", label: "🐾 I'm happy to train from scratch!", value: "needs_training" },
            ],
            12
          );
          break;

        case 12:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, trainingPreference: content }));
          setStep(13);
          addBotMessage(
            "*gentle tail wag*\n\nSome of my friends here have special medical needs or disabilities. They're just as loveable! Are you open to considering them?",
            [
              { id: "1", label: "💕 Yes, I'm open to special needs", value: "yes" },
              { id: "2", label: "🚫 Prefer no special needs", value: "no" },
              { id: "3", label: "🤔 Depends on the situation", value: "maybe" },
            ],
            13
          );
          break;

        case 13:
          if (!isSkipping) setPreferences((prev) => ({ ...prev, openToSpecialNeeds: content === "yes" || content === "maybe" }));
          setStep(14);
          addBotMessage(
            "*final excited wiggle*\n\nLast question! Would you like to only see dogs who are already spayed/neutered and up-to-date on vaccines?",
            [
              { id: "1", label: "✅ Yes, only fully vaccinated", value: "yes" },
              { id: "2", label: "🚫 Doesn't matter to me", value: "no" },
            ],
            14
          );
          break;

        case 14: {
          const finalPrefs = {
            ...preferences,
            requiresVaccinated: isSkipping ? undefined : content === "yes",
          };
          setPreferences(finalPrefs);
          setStep(15);

          // Let the user know we're fetching
          setMessages((prev) => [...prev, createMessage("bot", "*sniffs around excitedly*\n\nLet me check with my shelter friends and find the best pups for you...")]);
          setIsTyping(true);

          try {
            const payload: RecommendRequest = buildPayloadFromPreferences(finalPrefs);
            const response: RecommendResponse = await matchDogs(payload, 10000);

            const mapped = response.results.map(mapApiDogToDog);
            const recommended = mapped.filter((d, idx) => response.results[idx].section === "best");
            const explore = mapped.filter((d, idx) => response.results[idx].section === "explore");

            onRecommendations?.(recommended.slice(0, 10), explore);

            if (recommended.length > 0) {
              const dogNames = recommended.slice(0, 5).map(d => d.name).join(", ");
              addBotMessage(
                `*does happy zoomies in circles*\n\nOMG OMG OMG! I found ${recommended.length} friends who could be perfect for you!! 🎉\n\nSome of my besties who match are: ${dogNames}!\n\n*pants excitedly*\n\nClick below to meet them all! I just KNOW one of them is going to be your new best friend forever!`,
                [
                  { id: "browse", label: "🐾 Meet my matches!", value: "browse" },
                  { id: "restart", label: "🔄 Start over", value: "restart_chat" },
                ]
              );
            } else if (explore.length > 0) {
              addBotMessage(
                "No perfect matches right now, but let’s peek at the Explore pups—sometimes hidden gems are waiting! 🐾",
                [
                  { id: "browse", label: "🐾 Explore pups", value: "browse" },
                  { id: "restart", label: "🔄 Start over", value: "restart_chat" },
                ]
              );
            } else {
              addBotMessage(
                "*whimpers softly*\n\nNo perfect matches right now, and I don't have explore pups either. Want to browse anyway or try again?",
                [
                  { id: "browse", label: "🐾 Browse anyway", value: "browse" },
                  { id: "restart", label: "🔄 Try again", value: "restart_chat" },
                ]
              );
            }
          } catch (error) {
            const fallbackMatches = getRecommendations(finalPrefs);
            const exploreFallback = sampleDogs.filter(d => !fallbackMatches.find(m => m.id === d.id)).slice(0, 5);
            onRecommendations?.(fallbackMatches.slice(0, 10), exploreFallback);

            const friendlyDetail = error instanceof ApiError && error.body && (error.body as { detail?: string }).detail
              ? `\n\n(Reason: ${(error.body as { detail?: string }).detail})`
              : "";

            addBotMessage(
              `*tilts head apologetically*\n\nI couldn’t fetch live matches right now.${friendlyDetail}\n\nI picked some pups for you to browse while we try again!`,
              [
                { id: "browse", label: "🐾 Browse anyway", value: "browse" },
                { id: "restart", label: "🔄 Try again", value: "restart_chat" },
              ]
            );
          } finally {
            setIsTyping(false);
          }
          break;
        }

        default:
          addBotMessage(
            "*tilts head confused*\n\nHmm, I got a bit lost there! Let me help you meet some of my friends!",
            [
              { id: "browse", label: "🐾 Browse dogs", value: "browse" },
            ]
          );
      }
    },
    [step, preferences, messages, skipWarnings, goBack, resetChat, saveHistory, addBotMessage, getRecommendations, onRecommendations]
  );

  return (
    <ChatContext.Provider value={{
      messages,
      isTyping,
      currentStep: step,
      totalSteps,
      handleUserMessage,
      resetChat,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
