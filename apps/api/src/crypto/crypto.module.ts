import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** Global so any module can encrypt/decrypt credentials without re-importing. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
