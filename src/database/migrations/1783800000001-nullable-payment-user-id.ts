import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * No-op on fresh DBs — nullable userId is included in Schema1783612421651 CREATE.
 * Kept for migration history compatibility with DBs that already ran this file.
 */
export class NullablePaymentUserId1783800000001 implements MigrationInterface {
  name = 'NullablePaymentUserId1783800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_transactions');
    if (!table) return;

    const userId = table.findColumnByName('userId');
    if (!userId || userId.isNullable) return;

    const rows: Array<{ name: string }> = await queryRunner.query(`
      SELECT DISTINCT kcu.CONSTRAINT_NAME AS name
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME = kcu.TABLE_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'payment_transactions'
        AND kcu.COLUMN_NAME = 'userId'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `);

    for (const row of rows) {
      if (!row?.name) continue;
      await queryRunner.query(
        `ALTER TABLE \`payment_transactions\` DROP FOREIGN KEY \`${row.name}\``,
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` CHANGE \`userId\` \`userId\` varchar(36) NULL`,
    );

    const existing: Array<{ name: string }> = await queryRunner.query(`
      SELECT CONSTRAINT_NAME AS name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'payment_transactions'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND CONSTRAINT_NAME = 'FK_60b852936ca1e980cce98d977a2'
      LIMIT 1
    `);

    if (existing.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`payment_transactions\` ADD CONSTRAINT \`FK_60b852936ca1e980cce98d977a2\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(): Promise<void> {
    // Intentionally empty — do not force NOT NULL in production
  }
}
