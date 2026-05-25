import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen gap-4">
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/" className="text-sm underline underline-offset-4">Go home</Link>
    </div>
  );
}
