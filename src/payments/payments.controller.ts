import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import { ApiCreatedData, ApiOkData, PaymentVerifyResponseDto } from '../common/swagger';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentFulfillmentService } from './payment-fulfillment.service';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@RequireRole(RoleName.STUDENT)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
  ) {}

  @Post('verify')
  @ApiCreatedData(PaymentVerifyResponseDto)
  @ResponseMessage('Payment verified successfully')
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(dto, user.email);
  }

  @Post('courses/:courseId/resend-access')
  @ApiOkData(Object)
  @ResponseMessage('Course links sent successfully')
  resendCourseAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.paymentFulfillmentService.resendCourseAccess(user.id, courseId);
  }
}
