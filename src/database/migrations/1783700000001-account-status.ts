import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * No-op on fresh DBs — accountStatus is included in Schema1783612421651 CREATE.
 * Kept for migration history compatibility with DBs that already ran this file.
 */
export class AccountStatus1783700000001 implements MigrationInterface {
  name = 'AccountStatus1783700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table) return;

    const hasColumn = table.findColumnByName('accountStatus');
    if (hasColumn) return;

    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`accountStatus\` enum ('active', 'suspended', 'disabled') NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `UPDATE \`users\` SET \`accountStatus\` = 'disabled' WHERE \`isActive\` = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    if (!table?.findColumnByName('accountStatus')) return;

    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`accountStatus\``);
  }
}
