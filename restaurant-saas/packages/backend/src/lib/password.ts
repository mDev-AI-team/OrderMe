import bcrypt from 'bcrypt';

const COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
