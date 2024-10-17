import { defineConfig } from "vite";

export default defineConfig({
    server: {
        host: "0.0.0.0", // Questo rende il server accessibile da tutta la rete locale
        port: 3001, // Puoi specificare una porta, o lasciare il default (3000)
    },
});
