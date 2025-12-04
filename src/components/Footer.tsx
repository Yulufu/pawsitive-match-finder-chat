import { MapPin, Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-secondary/80 border-t border-border py-4 px-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <MapPin className="w-4 h-4 text-primary" />
          <span>Currently serving shelters in New York only</span>
        </div>
        <span className="hidden sm:block text-muted-foreground">•</span>
        <div className="flex items-center gap-2 text-foreground font-medium">
          <Shield className="w-4 h-4 text-primary" />
          <span>Your data is never stored or shared</span>
        </div>
      </div>
    </footer>
  );
}
