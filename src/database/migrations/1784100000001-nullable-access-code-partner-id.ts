import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Access codes are system-wide. partnerId is optional (legacy ownership only).
 * Idempotent: safe when the named FK is missing or partnerId is already nullable
 * (fresh deploys / partially applied schemas).
 */
export class NullableAccessCodePartnerId1784100000001
  implements MigrationInterface
{
  name = 'NullableAccessCodePartnerId1784100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table) return;

    await this.dropPartnerForeignKeys(queryRunner);

    const partnerId = table.findColumnByName('partnerId');
    if (partnerId && !partnerId.isNullable) {
      await queryRunner.query(`
        ALTER TABLE \`access_codes\`
        MODIFY \`partnerId\` varchar(36) NULL
      `);
    }

    await this.ensurePartnerForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table) return;

    await this.dropPartnerForeignKeys(queryRunner);

    await queryRunner.query(`
      UPDATE \`access_codes\` ac
      SET ac.\`partnerId\` = (
        SELECT p.\`id\` FROM \`partners\` p ORDER BY p.\`createdAt\` ASC LIMIT 1
      )
      WHERE ac.\`partnerId\` IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`access_codes\`
      MODIFY \`partnerId\` varchar(36) NOT NULL
    `);

    await this.ensurePartnerForeignKey(queryRunner);
  }

  private async dropPartnerForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ name: string }> = await queryRunner.query(`
      SELECT DISTINCT kcu.CONSTRAINT_NAME AS name
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME = kcu.TABLE_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'access_codes'
        AND kcu.COLUMN_NAME = 'partnerId'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `);

    for (const row of rows) {
      if (!row?.name) continue;
      await queryRunner.query(
        `ALTER TABLE \`access_codes\` DROP FOREIGN KEY \`${row.name}\``,
      );
    }
  }

  private async ensurePartnerForeignKey(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const existing: Array<{ name: string }> = await queryRunner.query(`
      SELECT CONSTRAINT_NAME AS name
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'access_codes'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND CONSTRAINT_NAME = 'FK_access_codes_partner'
      LIMIT 1
    `);

    if (existing.length > 0) return;

    const hasPartnerId: Array<{ cnt: number }> = await queryRunner.query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'access_codes'
        AND COLUMN_NAME = 'partnerId'
    `);

    if (!Number(hasPartnerId[0]?.cnt)) return;

    await queryRunner.query(`
      ALTER TABLE \`access_codes\`
      ADD CONSTRAINT \`FK_access_codes_partner\`
        FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`)
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }
}
