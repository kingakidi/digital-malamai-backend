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

    const fk = table.foreignKeys.find((f) =>
      f.columnNames.includes('userId'),
    );
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE \`payment_transactions\` DROP FOREIGN KEY \`${fk.name}\``,
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` CHANGE \`userId\` \`userId\` varchar(36) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` ADD CONSTRAINT \`FK_60b852936ca1e980cce98d977a2\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally empty — do not force NOT NULL in production
  }
}
