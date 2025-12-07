import { Link, useLocation } from "react-router-dom";
import { MessageCircle, Dog, Heart, HandHeart, MessageSquare } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import { cn } from "@/lib/utils";

export function Navigation() {
  const location = useLocation();
  const { favorites } = useFavorites();

  const mainLinks = [
    { to: "/", label: "Chat", icon: MessageCircle },
    { to: "/dogs", label: "Browse Dogs", icon: Dog },
    { to: "/favorites", label: "Favorites", icon: Heart, badge: favorites.length },
  ];

  const ctaLinks = [
    { to: "/donate", label: "Donate", icon: HandHeart, variant: "heart" as const },
    { to: "/feedback", label: "Feedback", icon: MessageSquare, variant: "accent" as const },
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
            {mainLinks.map((link) => {
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

            {/* CTA buttons with accent styling */}
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-border">
              {ctaLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                      link.variant === "heart"
                        ? isActive
                          ? "bg-heart text-heart-foreground"
                          : "bg-heart/10 text-heart hover:bg-heart/20"
                        : isActive
                          ? "bg-accent text-accent-foreground"
                          : "bg-accent/30 text-accent-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile CTA icons */}
            <div className="flex sm:hidden items-center gap-1 ml-1">
              {ctaLinks.map((link) => {
                const Icon = link.icon;

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      link.variant === "heart"
                        ? "bg-heart/10 text-heart hover:bg-heart/20"
                        : "bg-accent/30 text-accent-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </nav>
    </div>
  );
}
