import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface RenderedMailTemplate {
  subject: string;
  body: string;
}

@Injectable()
export class MailTemplateService {
  private readonly templatesDir = join(__dirname, '..', 'email-templates');

  render(templateName: string, variables: Record<string, string>): RenderedMailTemplate {
    const content = this.loadTemplate(templateName);
    const rendered = this.applyVariables(content, variables);
    return this.parseTemplate(rendered);
  }

  private loadTemplate(templateName: string): string {
    const templatePath = join(this.templatesDir, `${templateName}.mail`);

    if (!existsSync(templatePath)) {
      throw new Error(`Mail template not found: ${templateName}.mail`);
    }

    return readFileSync(templatePath, 'utf8');
  }

  private applyVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
  }

  private parseTemplate(content: string): RenderedMailTemplate {
    const lines = content.split(/\r?\n/);
    const subjectLine = lines.find((line) => line.startsWith('Subject:'));

    if (!subjectLine) {
      throw new Error('Mail template must include a Subject: line');
    }

    const subject = subjectLine.replace('Subject:', '').trim();
    const body = lines
      .slice(lines.indexOf(subjectLine) + 1)
      .join('\n')
      .trim();

    return { subject, body };
  }
}
