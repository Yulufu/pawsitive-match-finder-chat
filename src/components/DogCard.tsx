import { useState } from "react";
import { Heart } from "lucide-react";
import { Dog } from "@/types/dog";
import { useFavorites } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DogDetailModal } from "@/components/DogDetailModal";

interface DogCardProps {
  dog: Dog;
  imageUrl?: string;
}

export function DogCard({ dog, imageUrl }: DogCardProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const favorited = isFavorite(dog.id);
  const [detailOpen, setDetailOpen] = useState(false);

  const formattedAge =
    dog.ageText ||
    (dog.ageYears !== undefined
      ? `${dog.ageYears.toFixed(1).replace(/\.0$/, "")} yrs`
      : dog.ageMonths !== undefined
        ? `${dog.ageMonths} months`
        : dog.age);

  const sizeLabels = {
    small: "Small",
    medium: "Medium",
    large: "Large",
  };

  const energyLabels = {
    low: "Couch Potato 🛋️",
    medium: "Balanced ⚖️",
    high: "Energizer 🔋",
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking the favorite button
    if ((e.target as HTMLElement).closest("button")) return;
    setDetailOpen(true);
  };

  return (
    <>
      <article
        className="card-warm group cursor-pointer"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailOpen(true);
          }
        }}
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={imageUrl || dog.imageUrl || "/placeholder.svg"}
            alt={`${dog.name} - ${dog.breed}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(dog);
            }}
            className={cn(
              "btn-heart absolute top-3 right-3 bg-background/80 backdrop-blur-sm",
              favorited && "animate-pulse-heart"
            )}
            aria-label={favorited ? `Remove ${dog.name} from favorites` : `Add ${dog.name} to favorites`}
          >
            <Heart
              className={cn(
                "w-5 h-5 transition-colors",
                favorited ? "fill-heart text-heart" : "text-muted-foreground"
              )}
            />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/60 to-transparent p-4">
            <h3 className="font-display text-xl font-bold text-card">{dog.name}</h3>
            <p className="text-card/90 text-sm">{dog.breed}</p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {formattedAge}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {sizeLabels[dog.size]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {energyLabels[dog.energyLevel]}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">{dog.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {dog.traits.map((trait) => (
              <span
                key={trait}
                className="px-2 py-0.5 bg-accent/30 text-accent-foreground rounded-full text-xs font-medium"
              >
                {trait}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            {dog.goodWithKids && (
              <span className="flex items-center gap-1">
                👶 Kid Friendly
              </span>
            )}
            {dog.goodWithPets && (
              <span className="flex items-center gap-1">
                🐾 Pet Friendly
              </span>
            )}
          </div>
        </div>
      </article>

      <DogDetailModal
        dog={dog}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
