type DeviceInput = { ipAddress: string | null; macAddress: string | null; name: string };

const enabled = () => process.env.MIKROTIK_ENABLED === "true";

function baseUrl() {
  return (process.env.MIKROTIK_BASE_URL || "").replace(/\/$/, "");
}

function authHeader() {
  const user = process.env.MIKROTIK_USERNAME || "";
  const pass = process.env.MIKROTIK_PASSWORD || "";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function request(path: string, init?: RequestInit) {
  if (!enabled()) return null;
  const url = `${baseUrl()}/rest${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`MikroTik REST error ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function authorizeDevices(devices: DeviceInput[], minutes: number, childId: string) {
  if (!enabled()) return { mode: "simulation", authorized: devices.length };
  const list = process.env.MIKROTIK_ADDRESS_LIST || "rewardconnection-active";
  const timeout = `${minutes}m`;

  let count = 0;
  for (const device of devices) {
    if (!device.ipAddress) continue;
    await request("/ip/firewall/address-list", {
      method: "PUT",
      body: JSON.stringify({
        list,
        address: device.ipAddress,
        timeout,
        comment: `rewardconnection child=${childId} device=${device.name}`,
      }),
    });
    count++;
  }
  return { mode: "mikrotik", authorized: count };
}

export async function revokeDevices(devices: DeviceInput[]) {
  if (!enabled()) return { mode: "simulation", revoked: devices.length };
  const list = process.env.MIKROTIK_ADDRESS_LIST || "rewardconnection-active";
  const entries = (await request(`/ip/firewall/address-list?list=${encodeURIComponent(list)}`)) as Array<{ ".id": string; address: string }>;
  const ips = new Set(devices.map((d) => d.ipAddress).filter(Boolean));
  let count = 0;
  for (const entry of entries || []) {
    if (ips.has(entry.address)) {
      await request(`/ip/firewall/address-list/${encodeURIComponent(entry[".id"])}`, { method: "DELETE" });
      count++;
    }
  }
  return { mode: "mikrotik", revoked: count };
}
