import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Dog } from "@/types/dog";

interface FavoritesContextType {
  favorites: string[];
  favoriteDogs: Record<string, Dog>;
  toggleFavorite: (dog: Dog) => void;
  isFavorite: (dogId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dogFavorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favoriteDogs, setFavoriteDogs] = useState<Record<string, Dog>>(() => {
    try {
      const saved = localStorage.getItem("dogFavoritesData");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("dogFavorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("dogFavoritesData", JSON.stringify(favoriteDogs));
  }, [favoriteDogs]);

  const toggleFavorite = (dog: Dog) => {
    const isAlreadyFavorite = favorites.includes(dog.id);

    setFavorites((prev) =>
      isAlreadyFavorite ? prev.filter((id) => id !== dog.id) : [...prev, dog.id]
    );

    setFavoriteDogs((prev) => {
      if (isAlreadyFavorite) {
        const { [dog.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dog.id]: dog };
    });
  };

  const isFavorite = (dogId: string) => favorites.includes(dogId);

  return (
    <FavoritesContext.Provider value={{ favorites, favoriteDogs, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
