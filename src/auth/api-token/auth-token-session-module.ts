import { Module } from '@nestjs/common';

import { SessionModule } from '../session/session.module';

/**
 * @deprecated Use SessionModule directly. This module is kept for backwards compatibility.
 */
@Module({
  imports: [SessionModule],
  exports: [SessionModule],
})
export class AuthTokenSessionModule {}
