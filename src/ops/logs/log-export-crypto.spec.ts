import { createECDH } from 'crypto';

import { PRODUCTION_LOG_ECDH_CURVE } from '../../constants/production-log-constants';
import { decryptLogPayload, encryptLogPayload } from './log-export-crypto';

describe('log-export-crypto', () => {
  it('round-trips plaintext with ECDH P-256 and AES-256-GCM', () => {
    const client = createECDH(PRODUCTION_LOG_ECDH_CURVE);
    client.generateKeys();
    const plaintext = Buffer.from('superadmin-only log line\n', 'utf8');
    const encrypted = encryptLogPayload(plaintext, client.getPublicKey(undefined, 'uncompressed'));
    expect(encrypted.ciphertext).not.toContain('superadmin-only');
    expect(encrypted.algorithm).toBe('ECDH-P256+AES-256-GCM');
    const restored = decryptLogPayload(encrypted, client.getPrivateKey());
    expect(restored.equals(plaintext)).toBe(true);
  });
});
