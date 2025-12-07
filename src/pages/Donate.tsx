import { Heart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const shelters = [
  {
    name: "Animal Haven",
    description: "A no-kill shelter in Manhattan helping animals find loving homes since 1967.",
    url: "https://animalhavenshelter.org/donate/",
  },
  {
    name: "Muddy Paws Rescue",
    description: "A volunteer-run organization saving dogs from high-kill shelters.",
    url: "https://muddypawsrescue.org/donate/",
  },
  {
    name: "NYC ACC",
    description: "New York City's Animal Care Centers providing shelter and care.",
    url: "https://www.nycacc.org/get-involved/donate",
  },
  {
    name: "Wagtopia",
    description: "A foster-based rescue focusing on dogs in need across the tri-state area.",
    url: "https://wagtopia.org/donate/",
  },
];

export default function Donate() {
  return (
    <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-heart/10 mb-4">
          <Heart className="w-8 h-8 text-heart" />
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">
          Support Our Partner Shelters
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Your donation helps rescue dogs find their forever homes. Choose a shelter below to contribute directly to their lifesaving work.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shelters.map((shelter) => (
          <Card key={shelter.name} className="group hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{shelter.name}</CardTitle>
              <CardDescription>{shelter.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                className="w-full group-hover:bg-primary/90"
              >
                <a href={shelter.url} target="_blank" rel="noopener noreferrer">
                  Donate Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        PawMatch does not collect or process donations. You will be redirected to each shelter's official donation page.
      </p>
    </main>
  );
}
