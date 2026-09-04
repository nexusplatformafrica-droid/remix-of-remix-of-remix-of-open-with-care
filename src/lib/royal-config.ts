/**
 * Royal Fortune (RGS) operator credentials.
 *
 * Values must match the integration record saved in the Royal Fortune
 * operator dashboard exactly. Env vars override them when set.
 */
export const ROYAL = {
  /** Game id on the remote game server. */
  gameId: "royal-fortune",
  /** Operator id registered with the RGS. */
  operatorId: "betplus",
  /** Display name registered with the RGS. */
  displayName: "casino",
  /** Shared HMAC secret (fingerprint fdef44fdbf68). */
  secret: "57cd4683dd29bc592fe4b7c400bf37f2217f50ee308758576e62b2375099ac6b",
  /** Remote game server base URL. */
  baseUrl: "https://remix-of-remix-of-remix-of-royal-fo.vercel.app",
  /** Session currency configured on the RGS side. */
  currency: "EUR",
  /** Path of the wallet API this platform exposes to the game. */
  walletPath: "/api/public/royal/wallet",
  /**
   * Stable public origin the game server calls back on when the incoming
   * request host isn't publicly reachable (sandbox / localhost SSR).
   */
  walletOrigin: "https://project--7fc9c35e-99f9-488c-859b-e65304cb222b-dev.lovable.app",
} as const;

