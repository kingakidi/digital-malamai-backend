import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { WelcomeService } from './welcome.service';

@ApiExcludeController()
@Controller()
export class ApiWelcomeController {
  constructor(private readonly welcomeService: WelcomeService) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get()
  welcomeApi(@Res() res: Response): void {
    res.type('text/plain').send(this.welcomeService.getText());
  }
}
