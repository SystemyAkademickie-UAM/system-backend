import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createECDH } from 'crypto';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';

import { AdminAccessService } from '../../admin/admin-access.service';
import { SessionService } from '../../auth/session/session.service';
import {
  PRODUCTION_LOG_DIR_ENV,
  PRODUCTION_LOG_ECDH_CURVE,
} from '../../constants/production-log-constants';
import { formatLogCalendarDate } from './log-calendar';
import { decryptLogPayload } from './log-export-crypto';
import { LogStoreService } from './log-store.service';
import { ProductionLogsController } from './production-logs.controller';
import { ClientLogsController } from './client-logs.controller';
import { ProductionLogsService } from './production-logs.service';

describe('Production logs HTTP (supertest)', () => {
  let app: INestApplication;
  let previousDir: string | undefined;
  let isSuper = true;
  const logStore = new LogStoreService();

  beforeAll(async () => {
    previousDir = process.env[PRODUCTION_LOG_DIR_ENV];
    process.env[PRODUCTION_LOG_DIR_ENV] = mkdtempSync(join(tmpdir(), 'maq-logs-http-'));
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductionLogsController, ClientLogsController],
      providers: [
        ProductionLogsService,
        { provide: LogStoreService, useValue: logStore },
        {
          provide: AdminAccessService,
          useValue: {
            assertSuperAdmin: jest.fn(async () => {
              if (!isSuper) {
                throw new ForbiddenException('Not authorized');
              }
            }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            resolveSubjectFromRequest: jest.fn(async () => ({ userId: 9 })),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousDir === undefined) {
      delete process.env[PRODUCTION_LOG_DIR_ENV];
    } else {
      process.env[PRODUCTION_LOG_DIR_ENV] = previousDir;
    }
  });

  beforeEach(() => {
    isSuper = true;
    logStore.appendLine('log', 'HttpSpec', 'probe-line');
  });

  it('rejects list when the caller is not super', async () => {
    isSuper = false;
    await request(app.getHttpServer()).get('/api/admin/logs').expect(403);
  });

  it('lists days for superadmin', async () => {
    const response = await request(app.getHttpServer()).get('/api/admin/logs').expect(200);
    expect(response.body.days).toContain(formatLogCalendarDate(new Date()));
  });

  it('exports ciphertext that is not plaintext and decrypts with the client key', async () => {
    const client = createECDH(PRODUCTION_LOG_ECDH_CURVE);
    client.generateKeys();
    const response = await request(app.getHttpServer())
      .post('/api/admin/logs/export')
      .send({
        clientPublicKey: client.getPublicKey(undefined, 'uncompressed').toString('base64'),
        day: 'today',
      })
      .expect(200);
    expect(JSON.stringify(response.body)).not.toContain('probe-line');
    const plain = decryptLogPayload(response.body, client.getPrivateKey()).toString('utf8');
    expect(plain).toContain('probe-line');
  });

  it('returns 404 for a day with no file', async () => {
    const client = createECDH(PRODUCTION_LOG_ECDH_CURVE);
    client.generateKeys();
    await request(app.getHttpServer())
      .post('/api/admin/logs/export')
      .send({
        clientPublicKey: client.getPublicKey(undefined, 'uncompressed').toString('base64'),
        day: '1999-01-01T00-00',
      })
      .expect(404);
  });

  it('accepts an authenticated browser ingest into the same store', async () => {
    await request(app.getHttpServer())
      .post('/api/client-logs')
      .send({ level: 'error', message: 'window.onerror boom', source: 'main.jsx' })
      .expect(200);
    const today = formatLogCalendarDate(new Date());
    expect(logStore.readDayPlaintext(today).toString('utf8')).toContain('window.onerror boom');
  });
});
