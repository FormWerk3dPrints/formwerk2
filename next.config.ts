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

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
  },
};

// Log IP na inicialização
if (process.env.NODE_ENV === "development") {
  const localIp = getLocalIp();
  console.log(`\n✓ Acesse via rede em: http://${localIp}:3000\n`);
}

export default nextConfig;
