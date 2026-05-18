import { createServer } from "./server.js";

const port = Number(process.env["API_PORT"] ?? 3000);

const app = createServer();

app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
});