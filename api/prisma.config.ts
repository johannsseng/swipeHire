import "dotenv/config";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load the root .env (one directory up from api/)
config({ path: resolve(__dirname, "../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});