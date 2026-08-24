import { Module } from '@nestjs/common';
import { AvlUsersController } from './avl-users.controller';
import { AvlUsersService } from './avl-users.service';
import { AvlMonitorService } from './avl-monitor.service';

@Module({
  controllers: [AvlUsersController],
  providers: [AvlUsersService, AvlMonitorService],
})
export class AvlUsersModule {}
