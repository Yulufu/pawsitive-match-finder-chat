export interface Dog {
  id: string;
  name: string;
  breed: string;
  age: string;
  size: "small" | "medium" | "large";
  energyLevel: "low" | "medium" | "high";
  energyScore?: number; // 1-10 if provided by backend
  ageYears?: number;
  ageText?: string;
  ageMonths?: number;
  weightLbs?: number;
  goodWithKids: boolean;
  goodWithPets: boolean;
  description: string;
  imageUrl: string;
  photoUrls?: string[]; // Multiple photos for gallery
  shelterUrl?: string;  // Link to original shelter bio
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
  multiSelect?: boolean;
}
