import { useState } from "react";
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
  DialogClose,
} from "@/components/ui/dialog";
import {
  Heart,
  Ruler,
  Calendar,
  Zap,
  Baby,
  PawPrint,
  Share2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface DogDetailModalProps {
  dog: Dog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DogDetailModal({ dog, open, onOpenChange }: DogDetailModalProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  if (!dog) return null;

  const favorited = isFavorite(dog.id);

  // Combine imageUrl with photoUrls for the gallery
  const allPhotos = [
    dog.imageUrl,
    ...(dog.photoUrls || []),
  ].filter(Boolean) as string[];

  const hasMultiplePhotos = allPhotos.length > 1;

  const goToPrevious = () => {
    setCurrentPhotoIndex((prev) =>
      prev === 0 ? allPhotos.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentPhotoIndex((prev) =>
      prev === allPhotos.length - 1 ? 0 : prev + 1
    );
  };

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

  const formatAgeDetail = () => {
    if (dog.ageYears !== undefined) {
      return `${dog.ageYears.toFixed(1).replace(/\.0$/, "")} years`;
    }
    if (dog.ageMonths !== undefined) {
      return `${dog.ageMonths} months`;
    }
    return dog.ageText || dog.age;
  };

  const hasWeight = dog.weightLbs !== undefined;
  const formatWeightOrSize = () => {
    if (hasWeight) {
      return `${dog.weightLbs} lbs`;
    }
    return sizeLabels[dog.size];
  };

  // Derive energy score from category if not provided
  const getEnergyScore = () => {
    if (dog.energyScore !== undefined) return dog.energyScore;
    const categoryScores = { low: 3, medium: 5, high: 8 };
    return categoryScores[dog.energyLevel];
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
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) setCurrentPhotoIndex(0); // Reset on close
      onOpenChange(isOpen);
    }}>
      <DialogContent hideDefaultClose className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Photo Gallery */}
        <div className="relative">
          {/* Close Button - Top Left */}
          <DialogClose className="absolute left-3 top-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors">
            <X className="w-5 h-5" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <div className="aspect-[16/10] overflow-hidden bg-muted">
            <img
              src={allPhotos[currentPhotoIndex] || "/placeholder.svg"}
              alt={`${dog.name} - Photo ${currentPhotoIndex + 1}`}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
          </div>

          {/* Navigation Arrows */}
          {hasMultiplePhotos && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Photo Indicators */}
          {hasMultiplePhotos && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {allPhotos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentPhotoIndex
                      ? "bg-background w-4"
                      : "bg-background/50 hover:bg-background/70"
                  )}
                  aria-label={`Go to photo ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Photo Counter */}
          {hasMultiplePhotos && (
            <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium">
              {currentPhotoIndex + 1} / {allPhotos.length}
            </div>
          )}
          
          {/* Floating Actions */}
          <div className="absolute top-3 right-3 flex gap-2">
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
        </div>

        {/* Thumbnail Strip */}
        {hasMultiplePhotos && (
          <div className="flex gap-1 p-2 bg-muted/50 overflow-x-auto">
            {allPhotos.map((photo, index) => (
              <button
                key={index}
                onClick={() => setCurrentPhotoIndex(index)}
                className={cn(
                  "flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all",
                  index === currentPhotoIndex
                    ? "border-primary"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img
                  src={photo}
                  alt={`${dog.name} thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Name & Breed */}
        <div className="p-4 pb-0">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="font-display text-3xl font-bold">
              {dog.name}
            </DialogTitle>
            <p className="text-muted-foreground text-lg">{dog.breed}</p>
          </DialogHeader>
        </div>

        {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-px bg-border mt-4">
          <div className="bg-background p-4 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">
              {formatAgeDetail()}
            </p>
            <p className="text-xs text-muted-foreground">Age</p>
          </div>
          <div className="bg-background p-4 text-center">
            <Ruler className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">
              {formatWeightOrSize()}
            </p>
            <p className="text-xs text-muted-foreground">{hasWeight ? "Weight" : "Size"}</p>
          </div>
          <div className="bg-background p-4 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">{getEnergyScore()}/10</p>
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
                <p className="font-medium">
                  {energyLabels[dog.energyLevel]} ({getEnergyScore()}/10)
                </p>
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
            {dog.shelterUrl ? (
              <Button
                size="lg"
                className="w-full font-display text-lg gap-2"
                asChild
              >
                <a
                  href={dog.shelterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-5 h-5" />
                  Open Original Bio from Shelter
                </a>
              </Button>
            ) : (
              <Button size="lg" className="w-full font-display text-lg gap-2" disabled>
                <ExternalLink className="w-5 h-5" />
                Shelter link unavailable
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              View {dog.name}'s full profile on the shelter&apos;s website
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
