import { DogCard } from "@/components/DogCard";
import { useRecommendations } from "@/contexts/RecommendationsContext";
import { Sparkles, Compass, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Placeholder images for dogs - these would come from an API
const dogImages = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1544568100-847a948585b9?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1586671267731-da2cf3ceeb80?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?w=500&h=400&fit=crop",
];

export default function Dogs() {
  const { recommendations, exploreDogs, hasCompletedChat } = useRecommendations();

  // Empty state - user hasn't chatted with Melon yet
  if (!hasCompletedChat) {
    return (
      <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md space-y-6 animate-fade-in">
          <div className="w-24 h-24 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-5xl">🐶</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            No Recommendations Yet!
          </h1>
          <p className="text-muted-foreground">
            Chat with Melon first to get personalized dog recommendations based on your lifestyle and preferences!
          </p>
          <Link to="/" className="mt-8">
            <Button className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat with Melon
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-12">
      {/* Recommendations Section */}
      <section>
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-display font-bold text-foreground">
              Recommended for You
            </h2>
          </div>
          <p className="text-muted-foreground">
            Based on what you're looking for, these pups could be your perfect match! 🎯
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recommendations.map((dog, index) => (
            <div key={dog.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
              <DogCard dog={dog} imageUrl={dogImages[index % dogImages.length]} />
            </div>
          ))}
        </div>
      </section>

      {/* Explore Section */}
      <section>
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-display font-bold text-foreground">
              Explore Hidden Gems
            </h2>
          </div>
          <p className="text-muted-foreground">
            These sweet pups haven't gotten much attention yet — give them a look! 💎
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {exploreDogs.map((dog, index) => (
            <div key={`explore-${dog.id}`} className="animate-slide-up" style={{ animationDelay: `${(index + recommendations.length) * 50}ms` }}>
              <DogCard dog={dog} imageUrl={dogImages[(index + 5) % dogImages.length]} />
            </div>
          ))}
        </div>
      </section>

      <div className="text-center mt-12 p-8 bg-secondary/50 rounded-3xl">
        <p className="text-lg font-medium text-foreground mb-2">
          Can't decide? 🤔
        </p>
        <p className="text-muted-foreground">
          Go back to the chat and let Melon help you find your perfect match!
        </p>
      </div>
    </main>
  );
}
