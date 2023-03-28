import { Module } from '@nestjs/common';
import { EventsGateway } from './events/events.gateway';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [EventsModule, AuthModule],
  controllers: [],
  providers: [EventsGateway],
})
export class AppModule {}
