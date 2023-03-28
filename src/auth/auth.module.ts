import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { FortyTwoStrategy } from './strategies';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: '42',
      session: true,
    }),
  ],
  providers: [FortyTwoStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
