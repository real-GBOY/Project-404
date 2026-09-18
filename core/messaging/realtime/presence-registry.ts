/**
 * Who is online, per tenant. A user with two tabs has two sockets but is one
 * presence: `add` reports the FIRST socket, `remove` the LAST. In-memory by
 * design (presence is ephemeral and never touches PostgreSQL); a multi-node
 * deployment swaps this for a shared store behind the same two calls.
 */
export class PresenceRegistry {
  private readonly online = new Map<string, Map<string, number>>();

  /** @returns true when this is the user's first live socket in the tenant. */
  add(organizationId: string, userId: string): boolean {
    const users = this.online.get(organizationId) ?? new Map<string, number>();
    const next = (users.get(userId) ?? 0) + 1;
    users.set(userId, next);
    this.online.set(organizationId, users);
    return next === 1;
  }

  /** @returns true when the user's last socket in the tenant just closed. */
  remove(organizationId: string, userId: string): boolean {
    const users = this.online.get(organizationId);
    const current = users?.get(userId) ?? 0;
    if (!users || current === 0) return false;
    if (current === 1) {
      users.delete(userId);
      if (users.size === 0) this.online.delete(organizationId);
      return true;
    }
    users.set(userId, current - 1);
    return false;
  }

  onlineUserIds(organizationId: string): string[] {
    return [...(this.online.get(organizationId)?.keys() ?? [])];
  }
}
