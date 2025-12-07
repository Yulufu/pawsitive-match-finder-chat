import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import { DogCard } from "@/components/DogCard";
import { useFavorites } from "@/contexts/FavoritesContext";
import { sampleDogs } from "@/data/sampleDogs";
import { Button } from "@/components/ui/button";
export default function Favorites() {
  const {
    favorites,
    favoriteDogs: favoriteDogsMap
  } = useFavorites();
  const favoriteDogs = favorites
    .map((id) => favoriteDogsMap[id] || sampleDogs.find((dog) => dog.id === id))
    .filter(Boolean) as typeof sampleDogs;

  // Restore scroll position on mount, save on unmount
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('favoritesScrollPosition');
    if (savedPosition) {
      window.scrollTo(0, parseInt(savedPosition, 10));
    }

    return () => {
      sessionStorage.setItem('favoritesScrollPosition', window.scrollY.toString());
    };
  }, []);
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
        return <div key={dog.id} className="animate-fade-in">
              <DogCard dog={dog} />
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

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-border text-center">
        <Button variant="link" className="text-muted-foreground hover:text-primary">
          Share Feedback
        </Button>
      </footer>
    </main>;
}
