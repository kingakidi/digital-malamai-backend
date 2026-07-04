import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { RoleName } from '../common/types/permission.types';
import { ApiOkData, PaymentSyncSummaryResponseDto } from '../common/swagger';
import { SyncFlutterwaveQueryDto } from '../payments/dto/sync-flutterwave-query.dto';
import { PaymentSyncService } from '../payments/payment-sync.service';

@ApiTags('admin/payments')
@ApiBearerAuth()
@RequireRole(RoleName.SUPERADMIN)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentSyncService: PaymentSyncService) {}

  @Post('sync/flutterwave')
  @HttpCode(HttpStatus.OK)
  @ApiOkData(PaymentSyncSummaryResponseDto)
  @ResponseMessage('Flutterwave transactions synced successfully')
  syncFlutterwaveTransactions(@Query() query: SyncFlutterwaveQueryDto) {
    return this.paymentSyncService.syncRecentTransactions(query.days);
  }
}
