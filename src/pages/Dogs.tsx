import { useEffect, useState, useMemo } from "react";
import { DogCard } from "@/components/DogCard";
import { useRecommendations } from "@/contexts/RecommendationsContext";
import { useChat } from "@/contexts/ChatContext";
import { Sparkles, Compass, MessageCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { sampleDogs } from "@/data/sampleDogs";
import { matchDogs } from "@/lib/api";
import { mapApiDogToDog } from "@/contexts/ChatContext";

const DOGS_PER_PAGE = 5;

export default function Dogs() {
  const { recommendations, exploreDogs, hasCompletedChat, setExploreDogs } = useRecommendations();
  const { resetChat } = useChat();
  const navigate = useNavigate();
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [explorePage, setExplorePage] = useState(1);

  // Use sample dogs for explore section if user hasn't completed chat
  const allExploreDogs = hasCompletedChat
    ? exploreDogs
    : (exploreDogs.length > 0 ? exploreDogs : sampleDogs);

  const totalExplorePages = Math.ceil(allExploreDogs.length / DOGS_PER_PAGE);
  
  const displayExploreDogs = useMemo(() => {
    const startIndex = (explorePage - 1) * DOGS_PER_PAGE;
    return allExploreDogs.slice(startIndex, startIndex + DOGS_PER_PAGE);
  }, [allExploreDogs, explorePage]);

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

  // Prefetch explore dogs from backend for pre-chat browsing
  useEffect(() => {
    if (hasCompletedChat || exploreDogs.length > 0) return;
    let cancelled = false;
    const loadExplore = async () => {
      setExploreLoading(true);
      setExploreError(null);
      try {
        const res = await matchDogs({ hard_filters: {}, preferences: [], seen_dog_ids: [] });
        const mapped = res.results.map(mapApiDogToDog);
        const explore = mapped.filter((_, idx) => res.results[idx].section === "explore");
        const fallback = explore.length > 0 ? explore : mapped;
        if (!cancelled && fallback.length > 0) {
          setExploreDogs(fallback.slice(0, 20));
        }
      } catch (err) {
        if (!cancelled) {
          setExploreError("Could not load live explore pups. Showing sample dogs instead.");
        }
      } finally {
        if (!cancelled) {
          setExploreLoading(false);
        }
      }
    };
    loadExplore();
    return () => {
      cancelled = true;
    };
  }, [hasCompletedChat, exploreDogs.length, setExploreDogs]);

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
          {exploreLoading && (
            <p className="text-xs text-muted-foreground">Loading live pups...</p>
          )}
          {exploreError && (
            <p className="text-xs text-destructive">{exploreError}</p>
          )}
        </header>

        {displayExploreDogs.length === 0 ? (
          <div className="p-4 border border-dashed rounded-2xl text-muted-foreground">
            No explore pups yet—try updating your answers to see more options.
          </div>
        ) : (
          <>
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

            {/* Pagination */}
            {totalExplorePages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setExplorePage(p => Math.max(1, p - 1))}
                  disabled={explorePage === 1}
                  className="rounded-full"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalExplorePages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={page === explorePage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setExplorePage(page)}
                      className="w-8 h-8 rounded-full p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setExplorePage(p => Math.min(totalExplorePages, p + 1))}
                  disabled={explorePage === totalExplorePages}
                  className="rounded-full"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
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
