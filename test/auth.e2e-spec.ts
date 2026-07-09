import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp } from './create-e2e-app';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  const staffEmail = process.env.SUPER_ADMIN_EMAIL ?? process.env.E2E_STAFF_EMAIL;
  const staffPassword =
    process.env.SUPER_ADMIN_PASSWORD ?? process.env.E2E_STAFF_PASSWORD;

  beforeAll(async () => {
    app = await createE2eApp();
    apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns token for seeded superadmin', async () => {
    if (!staffEmail || !staffPassword) {
      return;
    }

    const response = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/login`)
      .send({
        email: staffEmail,
        password: staffPassword,
      })
      .expect(201);

    expect(response.body.status).toBe(true);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe(staffEmail);
  });

  it('GET /auth/profile returns current user when authenticated', async () => {
    if (!staffEmail || !staffPassword) {
      return;
    }

    const login = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/login`)
      .send({
        email: staffEmail,
        password: staffPassword,
      })
      .expect(201);

    const token = login.body.data.accessToken as string;

    const response = await request(app.getHttpServer())
      .get(`/${apiPrefix}/auth/profile`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.status).toBe(true);
    expect(response.body.data.email).toBe(staffEmail);
  });

  it('GET /admin/dashboard/overview returns metrics for authenticated staff', async () => {
    if (!staffEmail || !staffPassword) {
      return;
    }

    const login = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/login`)
      .send({
        email: staffEmail,
        password: staffPassword,
      })
      .expect(201);

    const token = login.body.data.accessToken as string;

    const response = await request(app.getHttpServer())
      .get(`/${apiPrefix}/admin/dashboard/overview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.status).toBe(true);
    expect(response.body.data.stats).toMatchObject({
      totalStudents: expect.any(Number),
      totalPartners: expect.any(Number),
    });
  });
});
