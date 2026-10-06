import { isIP } from "node:net";

export function normalizeMac(value: string) {
  const normalized = value.trim().replace(/-/g, ":").toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalized)) {
    throw new Error("INVALID_MAC");
  }
  return normalized;
}

export function normalizeIPv4(value: string) {
  const normalized = value.trim();
  if (isIP(normalized) !== 4) throw new Error("INVALID_IPV4");
  return normalized;
}

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => ((acc * 256) + Number(part)) >>> 0, 0);
}

export function isIPv4InCidr(ip: string, cidr: string) {
  if (isIP(ip) !== 4) return false;
  const [network, prefixRaw] = cidr.trim().split("/");
  if (isIP(network) !== 4) return false;
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

export function assertChildSubnet(ip: string) {
  const cidr = process.env.MIKROTIK_CHILD_SUBNET?.trim();
  if (cidr && !isIPv4InCidr(ip, cidr)) throw new Error("DEVICE_OUTSIDE_CHILD_SUBNET");
}

export function safeRouterId(value: string) {
  if (!/^[*A-Za-z0-9._-]+$/.test(value)) throw new Error("INVALID_ROUTER_ID");
  return value;
}
