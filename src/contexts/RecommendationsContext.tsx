import React, { createContext, useContext, useState, ReactNode } from "react";
import { Dog } from "@/types/dog";

interface RecommendationsContextType {
  recommendations: Dog[];
  exploreDogs: Dog[];
  hasCompletedChat: boolean;
  setRecommendations: (dogs: Dog[]) => void;
  setExploreDogs: (dogs: Dog[]) => void;
  setHasCompletedChat: (completed: boolean) => void;
  clearRecommendations: () => void;
}

const RecommendationsContext = createContext<RecommendationsContextType | undefined>(undefined);

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const [recommendations, setRecommendations] = useState<Dog[]>([]);
  const [exploreDogs, setExploreDogs] = useState<Dog[]>([]);
  const [hasCompletedChat, setHasCompletedChat] = useState(false);

  const clearRecommendations = () => {
    setRecommendations([]);
    setExploreDogs([]);
    setHasCompletedChat(false);
  };

  return (
    <RecommendationsContext.Provider
      value={{
        recommendations,
        exploreDogs,
        hasCompletedChat,
        setRecommendations,
        setExploreDogs,
        setHasCompletedChat,
        clearRecommendations,
      }}
    >
      {children}
    </RecommendationsContext.Provider>
  );
}

export function useRecommendations() {
  const context = useContext(RecommendationsContext);
  if (context === undefined) {
    throw new Error("useRecommendations must be used within a RecommendationsProvider");
  }
  return context;
}
