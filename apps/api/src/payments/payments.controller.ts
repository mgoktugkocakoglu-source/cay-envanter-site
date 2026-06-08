import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PaymentsService } from '@/payments/payments.service';
import {
    CreatePaymentDto,
    UpdatePaymentDto,
    PaymentQueryDto,
    CreateBrokerFirmDto,
    PaymentWithDetails,
    AssignFieldDto,
} from '@/payments/dto';
import { Payment, BrokerFirm } from '@/payments/entities';

interface AuthenticatedRequest {
    user: { id: string };
}

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new payment with harvest allocations' })
    @ApiResponse({ status: 201, description: 'Payment created successfully' })
    async create(
        @Request() req: AuthenticatedRequest,
        @Body() dto: CreatePaymentDto,
    ): Promise<Payment> {
        return this.paymentsService.create(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all payments for current user' })
    @ApiResponse({ status: 200, description: 'List of payments' })
    async findAll(
        @Request() req: AuthenticatedRequest,
        @Query() query: PaymentQueryDto,
    ): Promise<PaymentWithDetails[]> {
        return this.paymentsService.findAll(req.user.id, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment by ID with harvest details' })
    @ApiParam({ name: 'id', description: 'Payment UUID' })
    @ApiResponse({ status: 200, description: 'Payment details' })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    async findOne(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<Payment> {
        return this.paymentsService.findOne(id, req.user.id);
    }

    @Post(':id/assign-field')
    @ApiOperation({ summary: 'Attribute an auto-dropped Çaykur delivery to one of the producer\'s lands' })
    @ApiParam({ name: 'id', description: 'Payment UUID' })
    @ApiResponse({ status: 201, description: 'Delivery assigned to land' })
    async assignField(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignFieldDto,
    ): Promise<PaymentWithDetails> {
        return this.paymentsService.assignField(id, req.user.id, dto.fieldId);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update payment' })
    @ApiParam({ name: 'id', description: 'Payment UUID' })
    @ApiResponse({ status: 200, description: 'Payment updated' })
    async update(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdatePaymentDto,
    ): Promise<Payment> {
        return this.paymentsService.update(id, req.user.id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete payment' })
    @ApiParam({ name: 'id', description: 'Payment UUID' })
    @ApiResponse({ status: 204, description: 'Payment deleted' })
    async remove(
        @Request() req: AuthenticatedRequest,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<void> {
        return this.paymentsService.remove(id, req.user.id);
    }
}

@ApiTags('Broker Firms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('broker-firms')
export class BrokerFirmsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all broker firms' })
    @ApiResponse({ status: 200, description: 'List of broker firms' })
    async findAll(): Promise<BrokerFirm[]> {
        return this.paymentsService.getBrokerFirms();
    }

    @Post()
    @ApiOperation({ summary: 'Create a new broker firm' })
    @ApiResponse({ status: 201, description: 'Broker firm created' })
    async create(@Body() dto: CreateBrokerFirmDto): Promise<BrokerFirm> {
        return this.paymentsService.createBrokerFirm(dto);
    }
}
