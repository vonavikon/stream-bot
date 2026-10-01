import { readFileSync } from "node:fs";
import { config } from "./config.js";

let cache: string | null = null;

/** Читает taxonomy.md и кэширует. Файл статический, перечитывать на каждый запрос не нужно. */
export function loadTaxonomy(): string {
  if (cache === null) {
    cache = readFileSync(config.taxonomyPath, "utf-8");
  }
  return cache;
}
