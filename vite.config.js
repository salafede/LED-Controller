import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
    plugins: [basicSsl()],
    server: {
        https: true,
        open: "/index.html",
        host: "0.0.0.0", // Rende il server accessibile dalla rete locale
        port: 3001, // Puoi specificare una porta o lasciare quella di default (3000)
    },
});
