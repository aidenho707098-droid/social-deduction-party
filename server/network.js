import os from "node:os";

// A computer can have several network interfaces at once (WiFi, Ethernet,
// a VPN, virtual adapters from Docker/VMware, etc). We want the WiFi/LAN
// one — a VPN address won't be reachable by a phone on the same WiFi.
const LIKELY_NOT_LAN = /vpn|tun|tap|virtual|vmware|vbox|hyper-v|vethernet|docker/i;

export function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const addr of addresses ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        candidates.push({ name, address: addr.address });
      }
    }
  }

  const best = candidates.find((c) => !LIKELY_NOT_LAN.test(c.name));
  return (best ?? candidates[0])?.address ?? null;
}
