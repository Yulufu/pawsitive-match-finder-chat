import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { RecommendationsProvider, useRecommendations } from "@/contexts/RecommendationsContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import Index from "./pages/Index";
import Dogs from "./pages/Dogs";
import Favorites from "./pages/Favorites";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const { setRecommendations, setExploreDogs, setHasCompletedChat } = useRecommendations();

  return (
    <ChatProvider
      onRecommendations={(recommended, explore) => {
        setRecommendations(recommended);
        setExploreDogs(explore);
        setHasCompletedChat(true);
      }}
    >
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-background">
          <Navigation />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dogs" element={<Dogs />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ChatProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <FavoritesProvider>
        <RecommendationsProvider>
          <AppContent />
        </RecommendationsProvider>
      </FavoritesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
