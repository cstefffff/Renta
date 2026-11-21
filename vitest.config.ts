import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * ============================================================================
 * RentA (Faza 16 / M16.1) — Configurare Vitest pentru Teste Unitare Automate
 * (`vitest.config.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - Echivalentul configurării JUnit 5 în `pom.xml` / `build.gradle`: definește
 *   mediul de execuție (`node`), maparea alias-ului `@` către rădăcina
 *   proiectului (la fel ca `tsconfig.json`) și tiparul fișierelor de test.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
