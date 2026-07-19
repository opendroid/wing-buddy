// Landing stub for GET / — this service exposes only app/api/** route handlers.
// Its sole job is to answer the base URL with a plain "API only" note instead of
// a 404, so a human or health check hitting the root sees intent, not breakage.
export default function Home() {
  return <main>WingBuddy backend — API only. See /api/healthz.</main>;
}
