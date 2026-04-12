import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app-module';

describe('Counter (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/counter/health returns ok', () => {
    return request(app.getHttpServer()).get('/api/counter/health').expect(200).expect({ ok: true });
  });

  it('POST /api/counter/increment increments count', () => {
    return request(app.getHttpServer())
      .post('/api/counter/increment')
      .send({ currentCount: 0 })
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual({ count: 1 });
      });
  });

  it('POST /api/counter/increment rejects invalid body', () => {
    return request(app.getHttpServer())
      .post('/api/counter/increment')
      .send({ currentCount: -1 })
      .expect(400);
  });
});
