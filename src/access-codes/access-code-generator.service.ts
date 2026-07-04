import { randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

@Injectable()
export class AccessCodeGeneratorService {
  generateCode(length = 6): string {
    let code = '';

    for (let i = 0; i < length; i++) {
      code += ALPHANUM[randomInt(0, ALPHANUM.length)];
    }

    return code;
  }
}
