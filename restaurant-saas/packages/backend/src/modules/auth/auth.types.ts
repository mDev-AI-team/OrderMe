export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
