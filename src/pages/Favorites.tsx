import { Link } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import { DogCard } from "@/components/DogCard";
import { useFavorites } from "@/contexts/FavoritesContext";
import { sampleDogs } from "@/data/sampleDogs";
import { Button } from "@/components/ui/button";
const dogImages = ["https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&h=400&fit=crop", "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=400&fit=crop", "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=500&h=400&fit=crop", "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&h=400&fit=crop", "https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=500&h=400&fit=crop", "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=500&h=400&fit=crop"];
export default function Favorites() {
  const {
    favorites
  } = useFavorites();
  const favoriteDogs = sampleDogs.filter(dog => favorites.includes(dog.id));
  if (favoriteDogs.length === 0) {
    return <main className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <div className="w-24 h-24 rounded-full bg-secondary mx-auto flex items-center justify-center mb-6">
            <Heart className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            No Favorites Yet
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            You haven't saved any dogs to your favorites. Browse our available
            pups and tap the heart icon to save the ones you love!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link to="/dogs">
                Browse Dogs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with Melon
              </Link>
            </Button>
          </div>
        </div>
      </main>;
  }
  return <main className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Your Favorites 💕
        </h1>
        <p className="text-muted-foreground mt-2">
          {favoriteDogs.length} {favoriteDogs.length === 1 ? "pup" : "pups"} saved
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {favoriteDogs.map(dog => {
        const originalIndex = sampleDogs.findIndex(d => d.id === dog.id);
        return <div key={dog.id} className="animate-fade-in">
              <DogCard dog={dog} imageUrl={dogImages[originalIndex]} />
            </div>;
      })}
      </div>

      <div className="text-center mt-12 p-8 bg-primary/10 rounded-3xl">
        <p className="text-lg font-medium text-foreground mb-2">
          Ready to adopt? 🎉
        </p>
        <p className="text-muted-foreground mb-4">
          Contact your local rescue to learn more about meeting these amazing dogs!
        </p>
        <Button>
          Find Local Rescues
        </Button>
      </div>
    </main>;
}