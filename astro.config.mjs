import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://leegeunhyeok.github.io",
  base: "/hermes-compat-table",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
