import net from "node:net";

function ipv4Number(address) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function inIPv4Range(value, network, prefix) {
  const size = 2 ** (32 - prefix);
  return Math.floor(value / size) === Math.floor(network / size);
}

const BLOCKED_IPV4_RANGES = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
].map(([network, prefix]) => [ipv4Number(network), prefix]);

function expandIPv6(address) {
  let input = address.toLowerCase();
  if (input.includes("%")) return null;
  if (input.includes(".")) {
    const split = input.lastIndexOf(":");
    const v4 = ipv4Number(input.slice(split + 1));
    if (split < 0 || v4 === null) return null;
    input = input.slice(0, split + 1) +
      (v4 >>> 16).toString(16) + ":" + (v4 & 0xffff).toString(16);
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) ||
      (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return groups.reduce((value, part) => (value << 16n) | BigInt(parseInt(part, 16)), 0n);
}

function inIPv6Range(value, network, prefix) {
  const shift = 128n - BigInt(prefix);
  return (value >> shift) === (network >> shift);
}

const BLOCKED_IPV6_RANGES = [
  ["2001::", 23],       // IETF protocol assignments
  ["2001:db8::", 32],   // Documentation
  ["2002::", 16],       // 6to4 (may encode non-public IPv4 destinations)
  ["3fff::", 20]        // Documentation
].map(([address, prefix]) => [expandIPv6(address), prefix]);

/**
 * True only for globally routable unicast addresses suitable for outbound scans.
 * Special-use, private, shared, loopback, link-local, multicast and documentation
 * ranges are deliberately denied.
 */
export function isPublicIP(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    return value !== null && !BLOCKED_IPV4_RANGES.some(
      ([network, prefix]) => inIPv4Range(value, network, prefix)
    );
  }
  if (family === 6) {
    const value = expandIPv6(address);
    if (value === null || !inIPv6Range(value, expandIPv6("2000::"), 3)) return false;
    return !BLOCKED_IPV6_RANGES.some(
      ([network, prefix]) => inIPv6Range(value, network, prefix)
    );
  }
  return false;
}
