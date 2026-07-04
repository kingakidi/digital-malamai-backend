import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
    @Headers('flutterwave-signature') flutterwaveSignature: string | undefined,
    @Headers('verif-hash') legacySignature: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    this.flutterwaveService.verifyWebhookSignature(
      flutterwaveSignature,
      legacySignature,
    );

    return this.paymentFulfillmentService.handleWebhookPayload(payload);
  }
}
