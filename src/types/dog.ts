export interface Dog {
  id: string;
  name: string;
  breed: string;
  age: string;
  size: "small" | "medium" | "large";
  energyLevel: "low" | "medium" | "high";
  goodWithKids: boolean;
  goodWithPets: boolean;
  description: string;
  imageUrl: string;
  traits: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  options?: ChatOption[];
}

export interface ChatOption {
  id: string;
  label: string;
  value: string;
}
