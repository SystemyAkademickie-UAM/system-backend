import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHash,
  randomBytes,
} from 'crypto';

import {
  PRODUCTION_LOG_AES_ALGORITHM,
  PRODUCTION_LOG_AES_AUTH_TAG_LENGTH,
  PRODUCTION_LOG_AES_IV_LENGTH,
  PRODUCTION_LOG_AES_KEY_LENGTH,
  PRODUCTION_LOG_ECDH_CURVE,
} from '../../constants/production-log-constants';

export type EncryptedLogExport = {
  algorithm: string;
  serverPublicKey: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

function deriveAesKey(sharedSecret: Buffer): Buffer {
  return createHash('sha256').update(sharedSecret).digest();
}

/**
 * Encrypts log bytes so the HTTP body is ciphertext (AES-256-GCM via ECDH P-256).
 */
export function encryptLogPayload(
  plaintext: Buffer,
  clientPublicKey: Buffer,
): EncryptedLogExport {
  const ecdh = createECDH(PRODUCTION_LOG_ECDH_CURVE);
  ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(clientPublicKey);
  const key = deriveAesKey(sharedSecret);
  if (key.length !== PRODUCTION_LOG_AES_KEY_LENGTH) {
    throw new Error('Derived AES key length is invalid');
  }
  const iv = randomBytes(PRODUCTION_LOG_AES_IV_LENGTH);
  const cipher = createCipheriv(PRODUCTION_LOG_AES_ALGORITHM, key, iv, {
    authTagLength: PRODUCTION_LOG_AES_AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: 'ECDH-P256+AES-256-GCM',
    serverPublicKey: ecdh.getPublicKey(undefined, 'uncompressed').toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts a payload produced by {@link encryptLogPayload} (tests and local tools).
 */
export function decryptLogPayload(
  exportBody: EncryptedLogExport,
  clientPrivateKey: Buffer,
): Buffer {
  const ecdh = createECDH(PRODUCTION_LOG_ECDH_CURVE);
  ecdh.setPrivateKey(clientPrivateKey);
  const serverPublicKey = Buffer.from(exportBody.serverPublicKey, 'base64');
  const sharedSecret = ecdh.computeSecret(serverPublicKey);
  const key = deriveAesKey(sharedSecret);
  const iv = Buffer.from(exportBody.iv, 'base64');
  const decipher = createDecipheriv(PRODUCTION_LOG_AES_ALGORITHM, key, iv, {
    authTagLength: PRODUCTION_LOG_AES_AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(exportBody.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(exportBody.ciphertext, 'base64')),
    decipher.final(),
  ]);
}
