import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/users.service';
import { UsersController } from '@/users/users.controller';
import { CommunityPost } from '@/community/entities/community-post.entity';
import { CommunityComment } from '@/community/entities/community-comment.entity';
import { MailModule } from '@/mail/mail.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, CommunityPost, CommunityComment]),
        MailModule,
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
