/**
 * Web Push without a library: VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291 / RFC 8188),
 * using only Node's crypto and fetch. Works with Chrome/Android (FCM), Firefox, Edge and
 * Safari/iOS 16.4+ home-screen apps.
 */
import crypto from "node:crypto";

export type VapidKeys = { publicKey: string; privateJwk: crypto.JsonWebKey; subject: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

const b64url = (b: Buffer) => b.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

/** A new P-256 key pair: publicKey is the 65-byte uncompressed point, base64url (what browsers want). */
export function generateVapidKeys(subject: string): VapidKeys {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([0x04]), fromB64url(pub.x!), fromB64url(pub.y!)]);
  return { publicKey: b64url(raw), privateJwk: jwk, subject };
}

/** The Authorization header value for one push service (audience = its origin). */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const aud = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(Buffer.from(JSON.stringify({ aud, exp: nowSeconds + 12 * 3600, sub: keys.subject })));
  const input = `${header}.${claims}`;
  const key = crypto.createPrivateKey({ key: keys.privateJwk, format: "jwk" });
  const sig = crypto.sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${input}.${b64url(sig)}, k=${keys.publicKey}`;
}

/** Encrypts a payload for one subscription (single aes128gcm record). */
export function encryptPayload(payload: Buffer, target: { p256dh: string; auth: string }, opts?: { salt?: Buffer; ecdh?: crypto.ECDH }) {
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Bad subscription keys");
  const ecdh = opts?.ecdh ?? crypto.createECDH("prime256v1");
  if (!opts?.ecdh) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = opts?.salt ?? crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([0x02])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** Sends one push. Returns "gone" when the subscription has expired and should be deleted. */
export async function sendPush(target: PushTarget, payload: object, keys: VapidKeys, ttlSeconds = 86_400): Promise<"ok" | "gone" | "failed"> {
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), target);
  try {
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(target.endpoint, keys),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Urgency: "normal",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) {
      console.warn(`[push] ${new URL(target.endpoint).host} answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return "failed";
    }
    return "ok";
  } catch (err) {
    console.warn(`[push] send failed: ${(err as Error).message}`);
    return "failed";
  }
}
