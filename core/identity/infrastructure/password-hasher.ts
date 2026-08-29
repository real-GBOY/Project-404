import argon2 from "argon2";

/**
 * Password hashing (§7.1 "secure password hashing"). Argon2id with sane
 * parameters. Isolated behind an interface so it can be swapped or its cost
 * tuned without touching the use cases.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  /** True when the stored hash was produced with weaker params and should be re-hashed on next login. */
  needsRehash(hash: string): boolean;
}

const options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export const argon2Hasher: PasswordHasher = {
  hash: (plain) => argon2.hash(plain, options),
  verify: async (hash, plain) => {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  },
  needsRehash: (hash) => argon2.needsRehash(hash, options),
};
