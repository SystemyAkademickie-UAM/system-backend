import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { MAQ_AUTH_COOKIE_NAME } from '../constants/api-token-constants';
import { SAML_SESSION_COOKIE_NAME } from '../constants/saml-constants';
import {
  SWAGGER_BROWSER_ID_SECURITY_NAME,
  SWAGGER_ENABLED_ENV_KEY,
  SWAGGER_UI_PATH,
} from '../constants/swagger-constants';

/** Whether interactive OpenAPI UI should be mounted at `/api/docs`. */
export function isSwaggerEnabled(): boolean {
  const rawFlag = process.env[SWAGGER_ENABLED_ENV_KEY]?.trim().toLowerCase();
  if (rawFlag === 'true') {
    return true;
  }
  if (rawFlag === 'false') {
    return false;
  }
  return process.env.NODE_ENV !== 'production';
}

/** Registers Swagger UI and the generated OpenAPI document on the Nest app. */
export function setupSwagger(app: INestApplication): void {
  if (!isSwaggerEnabled()) {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('MyAcademyQuest API')
    .setDescription(
      'Try-it-out UI for implemented routes. Narrative API reference: docs/api.md. ' +
        'Authorize cookies (`maq_auth`, `saml_session`) and set header `X-Browser-ID` (UUID) where required.',
    )
    .setVersion('0.1.0')
    .addCookieAuth(MAQ_AUTH_COOKIE_NAME)
    .addCookieAuth(SAML_SESSION_COOKIE_NAME)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description: 'Opaque token from POST /api/login, sent as Authorization: Bearer <token>',
    })
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Browser-ID',
        description: 'RFC 4122 UUID bound to autoryzacja.tokens.browser_uuid',
      },
      SWAGGER_BROWSER_ID_SECURITY_NAME,
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });
}
