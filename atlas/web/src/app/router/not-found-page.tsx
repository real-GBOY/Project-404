import { Link } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-canvas px-6">
      <EmptyState
        icon="search"
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button asChild size="sm">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
