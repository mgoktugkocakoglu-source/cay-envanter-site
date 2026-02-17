import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
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
