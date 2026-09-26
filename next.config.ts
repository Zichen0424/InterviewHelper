import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined };
export default config;
