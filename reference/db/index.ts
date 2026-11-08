import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

function make() {
  return drizzle(neon(getEnv().DATABASE_URL), { schema });
}

let instance: ReturnType<typeof make> | undefined;

/** Lazy so importing this file never needs DATABASE_URL (builds, tests). */
export function getDb() {
  return (instance ??= make());
}
