import { SWAGGER_ENABLED_ENV_KEY } from '../constants/swagger-constants';
import { isSwaggerEnabled } from './swagger-setup';

describe('isSwaggerEnabled', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSwaggerFlag = process.env[SWAGGER_ENABLED_ENV_KEY];

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSwaggerFlag === undefined) {
      delete process.env[SWAGGER_ENABLED_ENV_KEY];
    } else {
      process.env[SWAGGER_ENABLED_ENV_KEY] = originalSwaggerFlag;
    }
  });

  it('returns true in non-production when SWAGGER_ENABLED is unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env[SWAGGER_ENABLED_ENV_KEY];
    expect(isSwaggerEnabled()).toBe(true);
  });

  it('returns false in production when SWAGGER_ENABLED is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env[SWAGGER_ENABLED_ENV_KEY];
    expect(isSwaggerEnabled()).toBe(false);
  });

  it('honours SWAGGER_ENABLED=true in production', () => {
    process.env.NODE_ENV = 'production';
    process.env[SWAGGER_ENABLED_ENV_KEY] = 'true';
    expect(isSwaggerEnabled()).toBe(true);
  });

  it('honours SWAGGER_ENABLED=false in development', () => {
    process.env.NODE_ENV = 'development';
    process.env[SWAGGER_ENABLED_ENV_KEY] = 'false';
    expect(isSwaggerEnabled()).toBe(false);
  });
});
