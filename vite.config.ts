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
        const apiResponse = await searchHandler(
          new Request(requestUrl, { method: request.method ?? "GET" }),
        );
        response.statusCode = apiResponse.status;
        apiResponse.headers.forEach((value, name) => {
          response.setHeader(name, value);
        });
        response.end(await apiResponse.text());
      } catch (error) {
        next(error);
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), localSearchApi],
});
