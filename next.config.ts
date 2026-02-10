import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Server Actions are enabled by default in Next.js 14+
    // Experimental features can be added here as needed
    serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
