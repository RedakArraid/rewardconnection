import * as http from "node:http";
import * as https from "node:https";
import { assertChildSubnet, normalizeIPv4, normalizeMac, safeRouterId } from "@/lib/network";

export type DeviceInput = {
  ipAddress: string | null;
  macAddress: string | null;
  name: string;
};

export type DhcpLease = {
  id: string;
  address: string;
  macAddress: string;
  hostName: string | null;
  status: string;
  dynamic: boolean;
  lastSeen: string | null;
  comment: string | null;
};

export type RouterStatus =
  | { mode: "simulation"; connected: false; message: string }
  | { mode: "mikrotik"; connected: true; boardName: string; version: string; uptime: string; cpuLoad: string };

export const isMikrotikEnabled = () => process.env.MIKROTIK_ENABLED === "true";

function config() {
  const baseUrl = (process.env.MIKROTIK_BASE_URL || "").replace(/\/$/, "");
  const username = process.env.MIKROTIK_USERNAME || "";
  const password = process.env.MIKROTIK_PASSWORD || "";
  const allowInsecureTls = process.env.MIKROTIK_ALLOW_INSECURE_TLS === "true";
  const timeoutMs = Number(process.env.MIKROTIK_REQUEST_TIMEOUT_MS || 5000);

  if (!baseUrl || !username || !password) throw new Error("ROUTER_CONFIG_ERROR");
  if (!/^https?:\/\//.test(baseUrl)) throw new Error("ROUTER_CONFIG_ERROR");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 500 || timeoutMs > 60000) throw new Error("ROUTER_CONFIG_ERROR");

  return { baseUrl, username, password, allowInsecureTls, timeoutMs };
}

function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (!isMikrotikEnabled()) throw new Error("ROUTER_DISABLED");
  const cfg = config();
  const url = new URL(`${cfg.baseUrl}/rest${path.startsWith("/") ? path : `/${path}`}`);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const authorization = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");

  return new Promise<T>((resolve, reject) => {
    const onResponse = (response: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const status = response.statusCode || 500;

        if (status < 200 || status >= 300) {
          console.error("MikroTik REST error", { status, body: raw.slice(0, 500) });
          reject(new Error("ROUTER_ERROR"));
          return;
        }

        if (!raw || status === 204) {
          resolve(undefined as T);
          return;
        }

        try {
          resolve(JSON.parse(raw) as T);
        } catch {
          reject(new Error("ROUTER_ERROR"));
        }
      });
    };

    const options: https.RequestOptions = {
      method,
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
      timeout: cfg.timeoutMs,
      ...(url.protocol === "https:" ? { rejectUnauthorized: !cfg.allowInsecureTls } : {}),
    };

    const req = url.protocol === "https:"
      ? https.request(url, options, onResponse)
      : http.request(url, options, onResponse);

    req.on("timeout", () => req.destroy(new Error("ROUTER_TIMEOUT")));
    req.on("error", (error) => {
      if (error.message === "ROUTER_TIMEOUT") reject(error);
      else {
        console.error("MikroTik connection error", error.message);
        reject(new Error("ROUTER_ERROR"));
      }
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function addressListName() {
  return process.env.MIKROTIK_ADDRESS_LIST || "rewardconnection-active";
}

export async function getRouterStatus(): Promise<RouterStatus> {
  if (!isMikrotikEnabled()) {
    return { mode: "simulation", connected: false, message: "Mode simulation : aucun routeur n'est piloté." };
  }

  const resource = await request<Record<string, string> | Array<Record<string, string>>>(
    "/system/resource?.proplist=board-name,version,uptime,cpu-load",
  );
  const row = Array.isArray(resource) ? (resource[0] || {}) : (resource || {});
  return {
    mode: "mikrotik",
    connected: true,
    boardName: row["board-name"] || "MikroTik",
    version: row.version || "inconnue",
    uptime: row.uptime || "inconnu",
    cpuLoad: row["cpu-load"] || "0",
  };
}

export async function listDhcpLeases(): Promise<DhcpLease[]> {
  if (!isMikrotikEnabled()) return [];
  const rows = await request<Array<Record<string, string>>>(
    "/ip/dhcp-server/lease?.proplist=.id,address,mac-address,host-name,status,dynamic,last-seen,comment",
  );

  return (rows || [])
    .filter((row) => row[".id"] && row.address && row["mac-address"])
    .map((row) => ({
      id: row[".id"],
      address: row.address,
      macAddress: normalizeMac(row["mac-address"]),
      hostName: row["host-name"] || null,
      status: row.status || "unknown",
      dynamic: row.dynamic === "true",
      lastSeen: row["last-seen"] || null,
      comment: row.comment || null,
    }));
}

export async function makeDhcpLeaseStatic(leaseId: string) {
  if (!isMikrotikEnabled()) return;
  await request<unknown>(
    "/ip/dhcp-server/lease/make-static",
    "POST",
    { numbers: safeRouterId(leaseId) },
  );
}

export async function authorizeDevices(
  devices: DeviceInput[],
  expiresAt: Date,
  childId: string,
  sessionId: string,
) {
  const usable = devices
    .filter((device): device is DeviceInput & { ipAddress: string } => Boolean(device.ipAddress))
    .map((device) => ({ ...device, ipAddress: normalizeIPv4(device.ipAddress) }));

  for (const device of usable) assertChildSubnet(device.ipAddress);

  if (!isMikrotikEnabled()) {
    return { mode: "simulation" as const, authorized: usable.length };
  }

  await revokeDevices(usable);

  const list = addressListName();
  const createdIds: string[] = [];

  try {
    for (const device of usable) {
      const remainingSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      const created = await request<Record<string, string>>("/ip/firewall/address-list", "PUT", {
        list,
        address: device.ipAddress,
        timeout: `${remainingSeconds}s`,
        comment: `rewardconnection session=${sessionId} child=${childId} device=${device.name.slice(0, 40)}`,
      });
      if (created?.[".id"]) createdIds.push(created[".id"]);
    }
  } catch (error) {
    for (const id of createdIds) {
      try {
        await request<void>(`/ip/firewall/address-list/${safeRouterId(id)}`, "DELETE");
      } catch (cleanupError) {
        console.error("Failed to rollback MikroTik address-list entry", cleanupError);
      }
    }
    throw error;
  }

  return { mode: "mikrotik" as const, authorized: usable.length };
}

export async function revokeDevices(devices: DeviceInput[]) {
  const ips = new Set(
    devices
      .map((device) => device.ipAddress)
      .filter((value): value is string => Boolean(value))
      .map(normalizeIPv4),
  );

  if (!isMikrotikEnabled()) return { mode: "simulation" as const, revoked: ips.size };
  if (!ips.size) return { mode: "mikrotik" as const, revoked: 0 };

  const list = addressListName();
  const entries = await request<Array<Record<string, string>>>(
    `/ip/firewall/address-list?list=${encodeURIComponent(list)}`,
  );

  let count = 0;
  for (const entry of entries || []) {
    if (entry[".id"] && entry.address && ips.has(entry.address)) {
      await request<void>(`/ip/firewall/address-list/${safeRouterId(entry[".id"])}`, "DELETE");
      count++;
    }
  }

  return { mode: "mikrotik" as const, revoked: count };
}
