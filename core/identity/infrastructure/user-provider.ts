import { Injectable } from "@nestjs/common";
import type { IUserProvider, User } from "@core/contracts/index.js";
import { UserRepository } from "./user-repository.js";

/**
 * The Identity module's implementation of the IUserProvider contract (§4).
 * This is the ONLY way other modules reach user data — they call
 * `getUser(userId)`, never `SELECT ... FROM users`.
 */
@Injectable()
export class IdentityUserProvider implements IUserProvider {
  constructor(private readonly users: UserRepository) {}

  async getUser(userId: string): Promise<User | null> {
    const user = await this.users.findById(userId);
    return user ? user.toPublic() : null;
  }

  async userExists(userId: string): Promise<boolean> {
    return this.users.exists(userId);
  }
}
