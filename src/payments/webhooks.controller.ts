import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FlutterwaveWebhookPayload } from '../common/types/payment.types';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ApiOkData, PaymentVerifyResponseDto } from '../common/swagger';
import { FlutterwaveService } from './flutterwave.service';
import { PaymentFulfillmentService } from './payment-fulfillment.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly flutterwaveService: FlutterwaveService,
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
  ) {}

  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  @ApiOkData(PaymentVerifyResponseDto)
  @ResponseMessage('Webhook processed successfully')
  handleFlutterwaveWebhook(
    @Headers('verif-hash') signature: string | undefined,
    @Body() payload: FlutterwaveWebhookPayload,
  ) {
    this.flutterwaveService.verifyWebhookSignature(signature);

    const transactionId = payload?.data?.id;

    if (!transactionId) {
      throw new BadRequestException('Webhook payload is missing transaction id');
    }

    return this.paymentFulfillmentService.verifyAndFulfill({
      transactionId: String(transactionId),
      source: 'webhook',
    });
  }
}
