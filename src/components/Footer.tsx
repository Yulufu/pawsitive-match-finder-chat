export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} PawMatch. Helping rescue dogs find their forever homes.
        </p>
      </div>
    </footer>
  );
}