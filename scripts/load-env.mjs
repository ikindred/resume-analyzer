/**
 * Next.js loads .env / .env.local automatically; plain Node scripts do not.
 * Load the same files so DATABASE_URL works when you run npm run migrate / seed.
 */
import dotenv from "dotenv";
import path from "node:path";
import { existsSync } from "node:fs";

const cwd = process.cwd();
dotenv.config({ path: path.join(cwd, ".env") });
if (existsSync(path.join(cwd, ".env.local"))) {
  dotenv.config({ path: path.join(cwd, ".env.local"), override: true });
}
