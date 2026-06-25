import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@/users/entities/user.entity';
import { Role, UserType, CaykurRole } from '@/auth/enums';
import { CAYKUR_ROLE_LABELS } from '@/auth/caykur-access';
import { UsersService } from '@/users/users.service';
import { MailService } from '@/mail/mail.service';
import { CreateStaffDto, UpdateStaffDto, StaffQueryDto } from '@/caykur/dto';
import { Paginated, paginate } from '@/common/dto/paginated.dto';

export interface StaffItem {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    province: string;
    district: string;
    caykurRole: CaykurRole;
    caykurScope: string | null;
    title: string;
    active: boolean;
    createdAt: Date;
}

@Injectable()
export class CaykurStaffService {
    private readonly logger = new Logger(CaykurStaffService.name);
    private readonly SALT_ROUNDS = 12;
    private readonly INVITE_TOKEN_EXPIRY_HOURS = 24;

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly usersService: UsersService,
        private readonly mailService: MailService,
    ) { }

    /**
     * Onboards a Çaykur staff member. The account is created pre-verified with a
     * temporary password; an invite email lets the person set their own password
     * via the existing reset-password page. The temp password is returned once so
     * the creator can share it if email delivery is unavailable.
     */
    async create(dto: CreateStaffDto): Promise<StaffItem & { tempPassword: string }> {
        const existingEmail = await this.usersService.findByEmail(dto.email);
        if (existingEmail) {
            throw new ConflictException('Bu email adresi zaten kayıtlı');
        }
        const existingPhone = await this.usersService.findByPhone(dto.phone);
        if (existingPhone) {
            throw new ConflictException('Bu telefon numarası zaten kayıtlı');
        }

        const tempPassword = this.generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, this.SALT_ROUNDS);
        const inviteToken = uuidv4();
        const inviteExpiry = new Date();
        inviteExpiry.setHours(inviteExpiry.getHours() + this.INVITE_TOKEN_EXPIRY_HOURS);

        const user = await this.usersService.create({
            fullName: dto.fullName,
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            phone: dto.phone,
            province: dto.province,
            district: dto.district,
            farmerIdNumber: null,
            cuzdanNo: null,
            userType: UserType.SELF_FARMER,
            role: Role.USER,
            caykurRole: dto.caykurRole,
            caykurScope: dto.caykurScope ?? null,
            emailVerified: true,
            verifiedAt: new Date(),
            resetPasswordToken: inviteToken,
            resetPasswordTokenExpiry: inviteExpiry,
        });

        await this.mailService.sendStaffInviteEmail(
            user.email,
            user.fullName,
            inviteToken,
            CAYKUR_ROLE_LABELS[dto.caykurRole],
        );

        this.logger.log(`Çaykur staff created: ${user.email} (${dto.caykurRole})`);
        return { ...this.toStaffItem(user), tempPassword };
    }

    async list(query: StaffQueryDto): Promise<Paginated<StaffItem>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.userRepository
            .createQueryBuilder('user')
            .where('user.deleted = :deleted', { deleted: false })
            .andWhere('user.caykurRole IS NOT NULL');

        if (query.search) {
            const term = `%${query.search.toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(user.fullName) LIKE :term OR LOWER(user.email) LIKE :term)',
                { term },
            );
        }
        if (query.caykurRole) {
            qb.andWhere('user.caykurRole = :role', { role: query.caykurRole });
        }
        if (query.status === 'active') {
            qb.andWhere('user.suspended = :suspended', { suspended: false });
        } else if (query.status === 'suspended') {
            qb.andWhere('user.suspended = :suspended', { suspended: true });
        }

        qb.orderBy('user.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [users, total] = await qb.getManyAndCount();
        return paginate(users.map((u) => this.toStaffItem(u)), total, page, limit);
    }

    async findOne(id: string): Promise<StaffItem> {
        const user = await this.getStaffUser(id);
        return this.toStaffItem(user);
    }

    async update(id: string, dto: UpdateStaffDto): Promise<StaffItem> {
        await this.getStaffUser(id);

        if (dto.phone) {
            const existingPhone = await this.usersService.findByPhone(dto.phone);
            if (existingPhone && existingPhone.id !== id) {
                throw new ConflictException('Bu telefon numarası zaten kayıtlı');
            }
        }

        const patch: Partial<User> = {};
        if (dto.fullName !== undefined) patch.fullName = dto.fullName;
        if (dto.phone !== undefined) patch.phone = dto.phone;
        if (dto.province !== undefined) patch.province = dto.province;
        if (dto.district !== undefined) patch.district = dto.district;
        if (dto.caykurRole !== undefined) patch.caykurRole = dto.caykurRole;
        if (dto.caykurScope !== undefined) patch.caykurScope = dto.caykurScope;
        if (dto.active !== undefined) patch.suspended = !dto.active;

        const updated = await this.usersService.update(id, patch);
        this.logger.log(`Çaykur staff updated: ${id}`);
        return this.toStaffItem(updated as User);
    }

    /** Soft-disable a staff account (suspend) rather than hard delete. */
    async remove(id: string): Promise<StaffItem> {
        await this.getStaffUser(id);
        const updated = await this.usersService.update(id, { suspended: true });
        this.logger.log(`Çaykur staff suspended: ${id}`);
        return this.toStaffItem(updated as User);
    }

    private async getStaffUser(id: string): Promise<User> {
        const user = await this.usersService.findById(id);
        if (!user || !user.caykurRole) {
            throw new NotFoundException('Personel bulunamadı');
        }
        return user;
    }

    private toStaffItem(user: User): StaffItem {
        return {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            province: user.province,
            district: user.district,
            caykurRole: user.caykurRole as CaykurRole,
            caykurScope: user.caykurScope,
            title: user.caykurRole ? CAYKUR_ROLE_LABELS[user.caykurRole] : '',
            active: !user.suspended,
            createdAt: user.createdAt,
        };
    }

    private generateTempPassword(): string {
        // Shareable fallback; staff set their own password via the invite link.
        return `Cay${uuidv4().replace(/-/g, '').slice(0, 8)}`;
    }
}
