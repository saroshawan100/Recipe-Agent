import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="text-7xl">🍳</div>
      <h1 className="mt-4 text-3xl font-semibold">This page burned to a crisp</h1>
      <p className="mt-2 text-muted">We couldn't find what you were looking for.</p>
      <Link to="/" className="mt-6">
        <Button>Back to the kitchen</Button>
      </Link>
    </div>
  );
}
