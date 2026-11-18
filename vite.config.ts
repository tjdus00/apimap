import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import searchHandler from "./api/search.ts";

const localSearchApi: Plugin = {
  name: "local-search-api",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const requestUrl = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`,
      );
      if (requestUrl.pathname !== "/api/search") {
        next();
        return;
      }

      try {
        await searchHandler(request, response);
      } catch (error) {
        next(error);
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), localSearchApi],
});
