import { createServer } from "./server.js";

// Hosts like Render inject PORT; fall back to API_PORT locally.
const port = Number(process.env["PORT"] ?? process.env["API_PORT"] ?? 3000);

const app = createServer();

const server = app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
});

// Graceful shutdown so in-flight requests finish during deploys/restarts.
function shutdown(signal: string) {
  console.log(`${signal} received — shutting down...`);
  server.close(() => process.exit(0));
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));