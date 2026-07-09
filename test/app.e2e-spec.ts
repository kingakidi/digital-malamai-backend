import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp } from './create-e2e-app';

describe('Digital Malamai API (e2e)', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;

  beforeAll(async () => {
    app = await createE2eApp();
    apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns welcome text', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.text).toContain('Digital Malamai');
  });

  it('GET /settings/onboarding-fee returns public fee', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${apiPrefix}/settings/onboarding-fee`)
      .expect(200);

    expect(response.body.status).toBe(true);
    expect(Number(response.body.data.amount)).not.toBeNaN();
  });

  it('GET /partners returns active partners list', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${apiPrefix}/partners`)
      .expect(200);

    expect(response.body.status).toBe(true);
    expect(Array.isArray(response.body.data.data)).toBe(true);
    expect(response.body.data.meta).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
    });
  });

  it('POST /auth/login rejects invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/login`)
      .send({
        email: 'not-a-real-user@example.com',
        password: 'wrong-password-123',
      })
      .expect(401);

    expect(response.body.status).toBe(false);
  });

  it('GET /admin/students requires authentication', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${apiPrefix}/admin/students`)
      .expect(401);

    expect(response.body.status).toBe(false);
  });
});
