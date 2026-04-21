import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { AppModule } from './app-module';
import { DEFAULT_CORS_ORIGINS } from './constants/cors-constants';
import { HTTP_HOST, HTTP_PORT } from './constants/server-constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(passport.initialize());
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const corsOrigins = corsOriginEnv
    ? corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [...DEFAULT_CORS_ORIGINS];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(HTTP_PORT, HTTP_HOST);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
