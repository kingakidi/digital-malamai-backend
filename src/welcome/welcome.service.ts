import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class WelcomeService {
  private cachedText: string | null = null;

  getText(): string {
    if (this.cachedText) {
      return this.cachedText;
    }

    const candidates = [
      join(__dirname, 'public', 'welcome.html'),
      join(__dirname, '..', 'public', 'welcome.html'),
      join(process.cwd(), 'src', 'public', 'welcome.html'),
      join(process.cwd(), 'dist', 'public', 'welcome.html'),
    ];

    const path = candidates.find((candidate) => existsSync(candidate));

    this.cachedText = path
      ? readFileSync(path, 'utf8').trim()
      : 'Welcome to Digital Malamai API';

    return this.cachedText;
  }
}
