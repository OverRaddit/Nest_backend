import { Module } from '@nestjs/common';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { MatchmakingqueueModule } from './matchmakingqueue/matchmakingqueue.module';

@Module({
  imports: [EventsModule, AuthModule, MatchmakingqueueModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
