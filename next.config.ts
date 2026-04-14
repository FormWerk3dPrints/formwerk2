import type { NextConfig } from "next";
import os from "os";

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  
  // Procura primeiro por adapters Wi-Fi
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wireless")) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  
  // Se não encontrar Wi-Fi, procura qualquer adapter não-local
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
};

const localIp = process.env.NODE_ENV === "development" ? getLocalIp() : undefined;

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  /* config options here */
  reactCompiler: true,
  ...(process.env.NODE_ENV === "development"
    ? {
        allowedDevOrigins: [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          ...(localIp ? [`http://${localIp}:3000`, `http://${localIp}`] : []),
        ],
      }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
    // Reduce variant count to lower optimization load
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [16, 48, 96, 256],
    // Keep webp only (AVIF encoding is much heavier on CPU)
    formats: ['image/webp'],
    // Cache optimized images for 1 year
    minimumCacheTTL: 31536000,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
  },
};

// Log IP na inicialização
if (process.env.NODE_ENV === "development") {
  console.log(`\n✓ Acesse via rede em: http://${localIp}:3000\n`);
}

export default nextConfig;
