import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountStatus1783700000001 implements MigrationInterface {
  name = 'AccountStatus1783700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`accountStatus\` enum ('active', 'suspended', 'disabled') NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `UPDATE \`users\` SET \`accountStatus\` = 'disabled' WHERE \`isActive\` = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`accountStatus\``,
    );
  }
}
