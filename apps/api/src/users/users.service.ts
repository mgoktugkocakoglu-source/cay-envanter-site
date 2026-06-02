import {
    Injectable,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/auth/enums';
import { MailService } from '@/mail/mail.service';

export interface AdminUserListItem {
    id: string;
    fullName: string;
    email: string;
    role: Role;
    isActive: boolean;
    isBanned: boolean;
    createdAt: Date;
}

export interface AdminUserListQuery {
    search?: string;
    role?: 'all' | Role;
    status?: 'all' | 'active' | 'banned';
}

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly mailService: MailService,
    ) { }

    async create(userData: Partial<User>): Promise<User> {
        const user = this.userRepository.create(userData);
        return this.userRepository.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { email: email.toLowerCase(), deleted: false },
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id, deleted: false },
        });
    }

    async findByFarmerIdNumber(farmerIdNumber: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { farmerIdNumber, deleted: false },
        });
    }

    async findByPhone(phone: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { phone, deleted: false },
        });
    }

    async searchUser(query: string, type: 'tc' | 'phone'): Promise<{
        id: string;
        fullName: string;
        userType: string;
    } | null> {
        const user = type === 'tc'
            ? await this.findByFarmerIdNumber(query)
            : await this.findByPhone(query);

        if (!user) {
            return null;
        }

        return {
            id: user.id,
            fullName: user.fullName,
            userType: user.userType,
        };
    }

    async findByVerificationToken(token: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { verificationToken: token, deleted: false },
        });
    }

    async findByResetToken(token: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { resetPasswordToken: token, deleted: false },
        });
    }

    async findByDeletionToken(token: string): Promise<User | null> {
        return this.userRepository.findOne({
            where: { deletionToken: token, deleted: false },
        });
    }

    async update(id: string, userData: Partial<User>): Promise<User | null> {
        await this.userRepository.update(id, userData);
        return this.findById(id);
    }

    async softDelete(id: string): Promise<void> {
        await this.userRepository.update(id, {
            deleted: true,
            deletedAt: new Date(),
            email: `deleted_${id}@deleted.local`,
            phone: `deleted_${id}`,
            farmerIdNumber: `DEL${id.substring(0, 8)}`,
            fullName: 'Deleted User',
            verificationToken: null,
            resetPasswordToken: null,
            deletionToken: null,
        });
    }

    /**
     * Permanent account deletion (Google Play Data Deletion compliance).
     *
     * Verifies the user's password, then removes the user row. All
     * user-owned data (fields, harvests, payments, sessions) is removed
     * via `onDelete: CASCADE` on the foreign keys pointing to users.
     */
    async deleteAccount(
        userId: string,
        password: string,
    ): Promise<{ message: string }> {
        if (!password) {
            throw new BadRequestException('Şifre gereklidir');
        }

        const user = await this.userRepository.findOne({
            where: { id: userId, deleted: false },
        });

        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            throw new UnauthorizedException('Şifre hatalı');
        }

        const emailToNotify = user.email;

        await this.userRepository.delete({ id: user.id });

        try {
            await this.mailService.sendAccountDeletedEmail(emailToNotify);
        } catch (error) {
            this.logger.warn(
                `Account deletion email failed for ${emailToNotify}: ${(error as Error).message}`,
            );
        }

        this.logger.log(`Account hard-deleted: ${emailToNotify}`);

        return { message: 'Hesabınız ve tüm verileriniz kalıcı olarak silindi' };
    }

    async listForAdmin(query: AdminUserListQuery = {}): Promise<AdminUserListItem[]> {
        const qb = this.userRepository
            .createQueryBuilder('user')
            .where('user.deleted = :deleted', { deleted: false });

        if (query.search) {
            const term = `%${query.search.toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(user.fullName) LIKE :term OR LOWER(user.email) LIKE :term)',
                { term },
            );
        }

        if (query.role && query.role !== 'all') {
            qb.andWhere('user.role = :role', { role: query.role });
        }

        if (query.status === 'active') {
            qb.andWhere('user.suspended = :suspended', { suspended: false });
        } else if (query.status === 'banned') {
            qb.andWhere('user.suspended = :suspended', { suspended: true });
        }

        qb.orderBy('user.createdAt', 'DESC');

        const users = await qb.getMany();

        if (users.length === 0) {
            return [];
        }

        return users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            isActive: !u.suspended,
            isBanned: u.suspended,
            createdAt: u.createdAt,
        }));
    }

    async setBanStatus(id: string, banned: boolean): Promise<AdminUserListItem> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }
        await this.userRepository.update(id, { suspended: banned });
        const [item] = await this.adminUserItems([id]);
        return item;
    }

    async setRole(id: string, role: Role): Promise<AdminUserListItem> {
        if (!Object.values(Role).includes(role)) {
            throw new BadRequestException('Geçersiz rol');
        }
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('Kullanıcı bulunamadı');
        }
        await this.userRepository.update(id, { role });
        const [item] = await this.adminUserItems([id]);
        return item;
    }

    private async adminUserItems(ids: string[]): Promise<AdminUserListItem[]> {
        const users = await this.userRepository.find({ where: { id: In(ids) } });

        return users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role,
            isActive: !u.suspended,
            isBanned: u.suspended,
            createdAt: u.createdAt,
        }));
    }

    async countUserData(
        _userId: string,
    ): Promise<{ parcelCount: number; harvestCount: number; postCount: number; reviewCount: number }> {
        // Placeholder - will be implemented when other modules exist
        return {
            parcelCount: 0,
            harvestCount: 0,
            postCount: 0,
            reviewCount: 0,
        };
    }
}
