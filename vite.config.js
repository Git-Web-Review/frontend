import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const parseAllowedHosts = (value) => {
    const hosts = value
        ?.split(",")
        .map((host) => host.trim())
        .filter(Boolean);
    if (!hosts?.length) {
        return undefined;
    }
    if (hosts.some((host) => host === "*" || host.toLowerCase() === "true")) {
        return true;
    }
    return hosts;
};
const allowedHosts = parseAllowedHosts(process.env.FRONTEND_ALLOWED_HOSTS);
export default defineConfig({
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        allowedHosts,
    },
    preview: {
        host: "0.0.0.0",
        port: 5173,
        allowedHosts,
    },
});
