/** Pure helpers for the Clients feature — no framework, no DB. */

/** The city is the last comma-separated segment of the address. */
export function cityOf(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim());
  return parts[parts.length - 1] || null;
}

/** The registration line shown on the client profile. */
export function registrationLabel(client: {
  taxId: string | null;
  type: "company" | "individual";
}): string {
  return (
    client.taxId ?? (client.type === "individual" ? "National ID on file" : "Registration on file")
  );
}
