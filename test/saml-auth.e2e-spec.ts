import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import passport from 'passport';
import request from 'supertest';
import selfsigned from 'selfsigned';
import { AppModule } from '../src/app-module';

describe('SAML auth (e2e)', () => {
  let app: INestApplication;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maq-saml-e2e-'));
    const pems = await selfsigned.generate(
      [{ name: 'commonName', value: 'maq-e2e-sp.example.test' }],
      { keySize: 2048 },
    );
    const certPath = path.join(tempDir, 'sp-cert.pem');
    const keyPath = path.join(tempDir, 'sp-key.pem');
    fs.writeFileSync(certPath, pems.cert, 'utf-8');
    fs.writeFileSync(keyPath, pems.private, 'utf-8');

    process.env.SAML_SP_ENTITY_ID = 'https://127.0.0.1:8080/api/auth/saml/metadata';
    process.env.SAML_ACS_URL = 'http://127.0.0.1:8080/api/auth/saml/acs';
    process.env.SAML_LOGIN_SUCCESS_URL = 'http://127.0.0.1:3000';
    process.env.SAML_JWT_SECRET = 'e2e-saml-jwt-secret-min-length';
    process.env.SAML_SP_CERT_PATH = certPath;
    process.env.SAML_SP_PRIVATE_KEY_PATH = keyPath;
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(passport.initialize());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/auth/saml/status reports SAML SP configuration', () => {
    const entityId = process.env.SAML_SP_ENTITY_ID;
    return request(app.getHttpServer())
      .get('/api/auth/saml/status')
      .expect(200)
      .expect((res) => {
        expect(res.body.configured).toBe(true);
        expect(res.body.entityId).toBe(entityId);
      });
  });

  it('GET /api/auth/saml/metadata returns application/xml', () => {
    return request(app.getHttpServer())
      .get('/api/auth/saml/metadata')
      .expect(200)
      .expect('Content-Type', /application\/xml/)
      .expect((res) => {
        expect(res.text).toContain('EntityDescriptor');
        expect(res.text).toContain(process.env.SAML_SP_ENTITY_ID ?? '');
      });
  });

  it('GET /api/auth/saml/login without organizationId returns 400', () => {
    return request(app.getHttpServer()).get('/api/auth/saml/login').expect(400);
  });

  it('GET /api/auth/saml/organizations returns a list', () => {
    return request(app.getHttpServer())
      .get('/api/auth/saml/organizations')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.organizations)).toBe(true);
      });
  });

  it('POST /api/auth/saml/acs without pending organization cookie returns 400', () => {
    return request(app.getHttpServer())
      .post('/api/auth/saml/acs')
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe('SAML_ORGANIZATION_PENDING_REQUIRED');
      });
  });

  it('POST /api/auth/saml/acs accepts organization id from SAML RelayState', () => {
    return request(app.getHttpServer())
      .post('/api/auth/saml/acs')
      .send({ RelayState: 'org:1' })
      .expect((res) => {
        expect(res.body?.error).not.toBe('SAML_ORGANIZATION_PENDING_REQUIRED');
      });
  });
});
