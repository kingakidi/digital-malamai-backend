import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safety net for students who completed onboarding payment but were left with
 * a non-onboarded status. Contact verification timestamps are intentionally
 * left unchanged so OTP can be re-enabled later without fake “verified” data.
 */
export class ActivatePaidOnboardedStudents1784500000001
  implements MigrationInterface
{
  name = 'ActivatePaidOnboardedStudents1784500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`users\` u
      INNER JOIN \`payment_transactions\` t
        ON t.\`userId\` = u.\`id\`
        AND t.\`paidFor\` = 'onboarding'
        AND t.\`status\` = 'success'
      SET u.\`onboardingStatus\` = 'onboarded'
      WHERE u.\`onboardingStatus\` IS NULL
         OR u.\`onboardingStatus\` <> 'onboarded'
    `);
  }

  public async down(): Promise<void> {
    // Irreversible data repair — paid students should remain onboarded.
  }
}
