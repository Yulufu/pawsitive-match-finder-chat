import { useEffect } from "react";
import { DogCard } from "@/components/DogCard";
import { useRecommendations } from "@/contexts/RecommendationsContext";
import { useChat } from "@/contexts/ChatContext";
import { Sparkles, Compass, MessageCircle, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { sampleDogs } from "@/data/sampleDogs";

export default function Dogs() {
  const { recommendations, exploreDogs, hasCompletedChat } = useRecommendations();
  const { resetChat } = useChat();
  const navigate = useNavigate();

  // Use sample dogs for explore section if user hasn't completed chat
  const displayExploreDogs = hasCompletedChat ? exploreDogs : sampleDogs;

  // Restore scroll position on mount, save on unmount
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('dogsScrollPosition');
    if (savedPosition) {
      window.scrollTo(0, parseInt(savedPosition, 10));
    }

    return () => {
      sessionStorage.setItem('dogsScrollPosition', window.scrollY.toString());
    };
  }, []);

  const handleRestartChat = () => {
    resetChat();
    sessionStorage.removeItem('dogsScrollPosition');
    window.scrollTo(0, 0);
    navigate("/");
  };

  return (
    <main className="container mx-auto px-4 py-8 space-y-12">
      {/* Recommendations Section - only show after chat */}
      {hasCompletedChat && (
        <section>
          <header className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-display font-bold text-foreground">Recommended for You</h2>
            </div>
            <p className="text-muted-foreground">
              Based on what you're looking for, these pups could be your perfect match! 🎯
            </p>
          </header>

          {recommendations.length === 0 ? (
            <div className="p-4 border border-dashed rounded-2xl text-muted-foreground">
              No perfect matches right now—check out the Explore pups below! 🐾
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recommendations.map((dog, index) => (
                <div key={dog.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <DogCard dog={dog} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* CTA to chat - only show before chat */}
      {!hasCompletedChat && (
        <div className="text-center p-8 bg-primary/10 rounded-3xl space-y-4 animate-fade-in">
          <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-3xl">🐶</span>
          </div>
          <p className="text-lg font-medium text-foreground">Want personalized recommendations?</p>
          <p className="text-muted-foreground">Chat with Melon to find your perfect match!</p>
          <Link to="/">
            <Button className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat with Melon
            </Button>
          </Link>
        </div>
      )}

      {/* Explore Section - always visible */}
      <section>
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-display font-bold text-foreground">Explore Hidden Gems</h2>
          </div>
          <p className="text-muted-foreground">
            These sweet pups haven't gotten much attention yet — give them a look! 💎
          </p>
        </header>

        {displayExploreDogs.length === 0 ? (
          <div className="p-4 border border-dashed rounded-2xl text-muted-foreground">
            No explore pups yet—try updating your answers to see more options.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {displayExploreDogs.map((dog, index) => (
              <div
                key={`explore-${dog.id}`}
                className="animate-slide-up"
                style={{ animationDelay: `${(index + (hasCompletedChat ? recommendations.length : 0)) * 50}ms` }}
              >
                <DogCard dog={dog} />
              </div>
            ))}
          </div>
        )}
      </section>

      {hasCompletedChat && (
        <div className="text-center mt-12 p-8 bg-secondary/50 rounded-3xl space-y-4">
          <p className="text-lg font-medium text-foreground">Want to update your preferences? 🔄</p>
          <p className="text-muted-foreground">Start a new chat with Melon to get fresh recommendations!</p>
          <Button onClick={handleRestartChat} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Update Preferences
          </Button>
        </div>
      )}
    </main>
  );
}
