import { readFileSync } from "node:fs";
import { config } from "./config.js";

let cache: string | null = null;

/** Reads taxonomy.md and caches it. The file is static; no need to re-read it on every request. */
export function loadTaxonomy(): string {
  if (cache === null) {
    cache = readFileSync(config.taxonomyPath, "utf-8");
  }
  return cache;
}
