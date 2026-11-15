import net from "node:net";

function normalizeHost(value) {
  const normalized = String(value).toLowerCase();
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

/**
 * Create a DNS lookup callback that can only return one already-validated IP.
 * The caller must validate the address against its private/reserved IP policy
 * before creating this callback.
 */
export function createPinnedLookup(expectedHostname, pinnedAddress) {
  const hostname = normalizeHost(expectedHostname);
  const family = net.isIP(pinnedAddress?.address);

  if (
    !hostname ||
    !family ||
    family !== pinnedAddress.family
  ) {
    throw new Error("A valid hostname and pinned IP address are required.");
  }

  const pinned = {
    address: pinnedAddress.address,
    family
  };

  return (lookupHostname, lookupOptions, callback) => {
    if (normalizeHost(lookupHostname) !== hostname) {
      callback(new Error("Unexpected hostname requested during connection."));
      return;
    }

    if (lookupOptions?.all) {
      callback(null, [pinned]);
      return;
    }

    callback(null, pinned.address, pinned.family);
  };
}
