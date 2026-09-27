import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="m-0 mb-2 text-heading font-extrabold">Page not found</h1>
      <p className="m-0 mb-5 text-body text-muted">That page doesn't exist in HotelOS.</p>
      <Link to="/" className="text-small font-semibold text-primary hover:text-primary-strong">
        ← Back to the dashboard
      </Link>
    </div>
  );
}
