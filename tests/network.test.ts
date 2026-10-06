import test from "node:test";
import assert from "node:assert/strict";
import { assertChildSubnet, isIPv4InCidr, normalizeIPv4, normalizeMac } from "../src/lib/network";

test("normalizeMac accepts common MAC formats", () => {
  assert.equal(normalizeMac("aa-bb-cc-dd-ee-ff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMac("AA:BB:CC:DD:EE:FF"), "AA:BB:CC:DD:EE:FF");
});

test("normalizeMac rejects malformed values", () => {
  assert.throws(() => normalizeMac("not-a-mac"), /INVALID_MAC/);
});

test("normalizeIPv4 accepts only IPv4", () => {
  assert.equal(normalizeIPv4("192.168.20.21"), "192.168.20.21");
  assert.throws(() => normalizeIPv4("2001:db8::1"), /INVALID_IPV4/);
});

test("CIDR membership works", () => {
  assert.equal(isIPv4InCidr("192.168.20.21", "192.168.20.0/24"), true);
  assert.equal(isIPv4InCidr("192.168.21.21", "192.168.20.0/24"), false);
  assert.equal(isIPv4InCidr("10.10.10.10", "0.0.0.0/0"), true);
});

test("assertChildSubnet rejects an IP outside the child subnet", () => {
  process.env.MIKROTIK_CHILD_SUBNET = "192.168.20.0/24";
  assert.doesNotThrow(() => assertChildSubnet("192.168.20.4"));
  assert.throws(() => assertChildSubnet("192.168.10.4"), /DEVICE_OUTSIDE_CHILD_SUBNET/);
});
