/** Web Push: payload decrypts as a browser would (RFC 8291) and the VAPID JWT verifies. Run: npm run test:push */
import crypto from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptPayload, generateVapidKeys, vapidAuthorization } from "../server/notify/webpush";
const ok = (c: boolean, m: string) => assert.ok(c, m);

test("web push encryption and VAPID", () => {

// Browser side: subscription keys
const ua = crypto.createECDH("prime256v1"); ua.generateKeys();
const auth = crypto.randomBytes(16);
const sub = { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
const msg = "When I grow up, I want to be a watermelon";
const body = encryptPayload(Buffer.from(msg), sub);

// Decrypt as the browser would (RFC 8188 header + RFC 8291 keys)
const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20];
const asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
ok(rs === 4096 && idlen === 65, "header");
const shared = ua.computeSecret(asPub);
const prk = crypto.createHmac("sha256", auth).update(shared).digest();
const ikm = crypto.createHmac("sha256", prk).update(Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPub, Buffer.from([1])])).digest();
const prk2 = crypto.createHmac("sha256", salt).update(ikm).digest();
const cek = crypto.createHmac("sha256", prk2).update(Buffer.from("Content-Encoding: aes128gcm\0\x01")).digest().subarray(0, 16);
const nonce = crypto.createHmac("sha256", prk2).update(Buffer.from("Content-Encoding: nonce\0\x01")).digest().subarray(0, 12);
const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
d.setAuthTag(ct.subarray(ct.length - 16));
const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
ok(plain[plain.length - 1] === 2 && plain.subarray(0, -1).toString() === msg, "round trip with manual HKDF");

// VAPID JWT verifies with the advertised public key
const keys = generateVapidKeys("mailto:test@example.com");
const h = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, 1_700_000_000);
const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
const claims = JSON.parse(Buffer.from(m[2], "base64url").toString());
ok(claims.aud === "https://fcm.googleapis.com" && claims.exp === 1_700_000_000 + 43200, "claims");
const raw = Buffer.from(m[4], "base64url");
ok(raw.length === 65 && raw[0] === 4, "public key format");
const pub = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
ok(crypto.verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3], "base64url")), "signature verifies");
});
