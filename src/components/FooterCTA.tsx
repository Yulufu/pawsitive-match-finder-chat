import { Link } from "react-router-dom";
import { HandHeart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
export function FooterCTA() {
  return <footer className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-t border-border mt-12">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-center">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-center gap-2 mb-2">
              <HandHeart className="w-5 h-5 text-heart" />
              <span className="font-display font-bold text-foreground">Support the Pups</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Help us maintain PawMatch</p>
            <Link to="/donate">
              <Button variant="default" className="bg-heart hover:bg-heart/90 text-heart-foreground gap-2">
                <HandHeart className="w-4 h-4" />
                Donate Now
              </Button>
            </Link>
          </div>

          <div className="hidden sm:block w-px h-16 bg-border" />

          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-accent-foreground" />
              <span className="font-display font-bold text-foreground">Share Your Thoughts</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Help us improve PawMatch
            </p>
            <Link to="/feedback">
              <Button variant="outline" className="gap-2 border-accent bg-accent/20 hover:bg-accent/40">
                <MessageSquare className="w-4 h-4" />
                Give Feedback
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </footer>;
}