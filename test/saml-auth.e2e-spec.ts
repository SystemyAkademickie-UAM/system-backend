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
    process.env.SAML_ENTRY_POINT = 'https://idp.example.test/simplesaml/saml2/idp/SSOService.php';
    process.env.SAML_IDP_CERT = pems.cert;
    process.env.SAML_SP_PUBLIC_CERT_PATH = certPath;
    process.env.SAML_SP_PRIVATE_KEY_PATH = keyPath;
    process.env.SAML_SESSION_JWT_SECRET = 'e2e-saml-jwt-secret';
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

  it('GET /api/auth/saml/status lists SAML readiness', () => {
    return request(app.getHttpServer())
      .get('/api/auth/saml/status')
      .expect(200)
      .expect((res) => {
        expect(res.body.configurationComplete).toBe(true);
        expect(res.body.samlReady).toBe(true);
        expect(res.body.requirements.SAML_SP_ENTITY_ID).toBe(true);
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

  it('GET /api/auth/saml/login redirects toward IdP entryPoint', () => {
    return request(app.getHttpServer())
      .get('/api/auth/saml/login')
      .expect(302)
      .expect('Location', /idp\.example\.test/);
  });

  it('POST /api/auth/saml/acs without SAMLResponse is not a successful login', () => {
    return request(app.getHttpServer())
      .post('/api/auth/saml/acs')
      .send({})
      .expect((res) => {
        expect([302, 400, 401]).toContain(res.status);
      });
  });
});
