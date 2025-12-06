import { Dog } from "@/types/dog";
import { useFavorites } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart,
  MapPin,
  Ruler,
  Calendar,
  Zap,
  Baby,
  PawPrint,
  Cat,
  Share2,
  Mail,
} from "lucide-react";

interface DogDetailModalProps {
  dog: Dog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DogDetailModal({ dog, open, onOpenChange }: DogDetailModalProps) {
  const { toggleFavorite, isFavorite } = useFavorites();

  if (!dog) return null;

  const favorited = isFavorite(dog.id);

  const sizeLabels = {
    small: "Small (under 25 lbs)",
    medium: "Medium (25-50 lbs)",
    large: "Large (50+ lbs)",
  };

  const energyLabels = {
    low: "Low Energy",
    medium: "Moderate Energy",
    high: "High Energy",
  };

  const energyDescriptions = {
    low: "Loves relaxing and cozy cuddles",
    medium: "Enjoys walks and playtime with rest in between",
    high: "Thrives on adventures and active lifestyle",
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Meet ${dog.name}!`,
        text: `${dog.name} is looking for a forever home! ${dog.breed}, ${dog.age}`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Hero Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={dog.imageUrl || "/placeholder.svg"}
            alt={`${dog.name} - ${dog.breed}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
          
          {/* Floating Actions */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
              aria-label="Share"
            >
              <Share2 className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={() => toggleFavorite(dog)}
              className={cn(
                "p-2.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors",
                favorited && "animate-pulse-heart"
              )}
              aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={cn(
                  "w-5 h-5 transition-colors",
                  favorited ? "fill-heart text-heart" : "text-foreground"
                )}
              />
            </button>
          </div>

          {/* Name & Breed Overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="font-display text-3xl font-bold text-card">
                {dog.name}
              </DialogTitle>
              <p className="text-card/90 text-lg">{dog.breed}</p>
            </DialogHeader>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-background p-4 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">{dog.age}</p>
            <p className="text-xs text-muted-foreground">Age</p>
          </div>
          <div className="bg-background p-4 text-center">
            <Ruler className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium capitalize">{dog.size}</p>
            <p className="text-xs text-muted-foreground">Size</p>
          </div>
          <div className="bg-background p-4 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium capitalize">{dog.energyLevel}</p>
            <p className="text-xs text-muted-foreground">Energy</p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Compatibility */}
          <div className="space-y-3">
            <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Compatibility
            </h4>
            <div className="flex flex-wrap gap-3">
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  dog.goodWithKids
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-border text-muted-foreground"
                )}
              >
                <Baby className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {dog.goodWithKids ? "Good with kids" : "Not ideal for kids"}
                </span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  dog.goodWithPets
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-border text-muted-foreground"
                )}
              >
                <PawPrint className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {dog.goodWithPets ? "Good with dogs" : "Prefers being only pet"}
                </span>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="space-y-3">
            <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              About {dog.name}
            </h4>
            <p className="text-foreground leading-relaxed">{dog.description}</p>
          </div>

          {/* Energy Level */}
          <div className="space-y-3">
            <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Activity Level
            </h4>
            <div className="flex items-start gap-3 p-4 bg-accent/20 rounded-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{energyLabels[dog.energyLevel]}</p>
                <p className="text-sm text-muted-foreground">
                  {energyDescriptions[dog.energyLevel]}
                </p>
              </div>
            </div>
          </div>

          {/* Traits */}
          {dog.traits.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Personality Traits
              </h4>
              <div className="flex flex-wrap gap-2">
                {dog.traits.map((trait) => (
                  <Badge
                    key={trait}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm font-medium"
                  >
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="pt-4 space-y-3">
            <Button
              size="lg"
              className="w-full font-display text-lg gap-2"
              onClick={() => {
                // TODO: Implement inquiry flow
              }}
            >
              <Mail className="w-5 h-5" />
              Inquire About {dog.name}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              We'll connect you with the shelter to learn more about {dog.name}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
