/**
 * NotFound.jsx — 404 page for unrecognised routes (*).
 */
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <span className="material-symbols-outlined text-6xl text-outline mb-6">
        monitoring
      </span>
      <h1 className="font-headline text-7xl font-extrabold text-on-surface mb-3">404</h1>
      <p className="text-lg text-on-surface-variant mb-8">Page not found</p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary-container rounded-xl text-sm font-semibold"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
