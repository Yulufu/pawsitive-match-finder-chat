import { Link, useLocation } from "react-router-dom";
import { MessageCircle, Dog, Heart, HandHeart } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const location = useLocation();
  const { favorites } = useFavorites();

  const showDonationButton = location.pathname === "/dogs" || location.pathname === "/favorites";

  const links = [
    { to: "/", label: "Chat", icon: MessageCircle },
    { to: "/dogs", label: "Browse Dogs", icon: Dog },
    { to: "/favorites", label: "Favorites", icon: Heart, badge: favorites.length },
  ];

  return (
    <div className="sticky top-0 z-50">
      {/* Global Disclaimer Banner */}
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-1.5 text-center">
          <p className="text-xs text-muted-foreground font-semibold">
            🗽 Currently serving NY shelters only • Your data is not stored
          </p>
        </div>
      </div>
      
      <nav className="bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center group-hover:animate-wag">
              <span className="text-xl">🐾</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              PawMatch
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {showDonationButton && (
              <Button variant="outline" size="sm" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10">
                <HandHeart className="w-4 h-4" />
                <span className="hidden sm:inline">Donate</span>
              </Button>
            )}
            {links.map((link) => {
              const isActive = location.pathname === link.to;
              const Icon = link.icon;

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "nav-link flex items-center gap-2 relative",
                    isActive ? "nav-link-active" : "nav-link-inactive"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-heart text-heart-foreground text-xs flex items-center justify-center font-semibold">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      </nav>
    </div>
  );
}
