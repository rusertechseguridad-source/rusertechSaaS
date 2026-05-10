import { Module } from '@nestjs/common';
import { AvlUsersController } from './avl-users.controller';
import { AvlUsersService } from './avl-users.service';

@Module({
  controllers: [AvlUsersController],
  providers: [AvlUsersService],
})
export class AvlUsersModule {}
