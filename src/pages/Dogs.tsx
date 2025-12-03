import { DogCard } from "@/components/DogCard";
import { sampleDogs } from "@/data/sampleDogs";

// Placeholder images for dogs - these would come from an API
const dogImages = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?w=500&h=400&fit=crop",
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=500&h=400&fit=crop",
];

export default function Dogs() {
  return (
    <main className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Meet Our Rescue Pups 🐾
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Every dog here is looking for their forever home. Click the heart to
          save your favorites!
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleDogs.map((dog, index) => (
          <div key={dog.id} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
            <DogCard dog={dog} imageUrl={dogImages[index]} />
          </div>
        ))}
      </div>

      <div className="text-center mt-12 p-8 bg-secondary/50 rounded-3xl">
        <p className="text-lg font-medium text-foreground mb-2">
          Can't decide? 🤔
        </p>
        <p className="text-muted-foreground">
          Go back to the chat and let Buddy help you find your perfect match!
        </p>
      </div>
    </main>
  );
}
