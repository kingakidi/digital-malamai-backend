import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Access codes are validated system-wide (unused + exists), not per partner.
 * Replace composite UNIQUE(code, partnerId) with UNIQUE(code).
 */
export class UniqueAccessCodeGlobally1784000000001
  implements MigrationInterface
{
  name = 'UniqueAccessCodeGlobally1784000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table) return;

    // Keep one row per code (prefer used, else oldest). Drop only safe unused duplicates.
    await queryRunner.query(`
      CREATE TEMPORARY TABLE \`tmp_access_code_keepers\` AS
      SELECT
        \`code\`,
        SUBSTRING_INDEX(
          GROUP_CONCAT(\`id\` ORDER BY \`isUsed\` DESC, \`createdAt\` ASC, \`id\` ASC SEPARATOR ','),
          ',',
          1
        ) AS \`keep_id\`
      FROM \`access_codes\`
      GROUP BY \`code\`
    `);

    await queryRunner.query(`
      DELETE ac FROM \`access_codes\` ac
      LEFT JOIN \`tmp_access_code_keepers\` k ON k.\`keep_id\` = ac.\`id\`
      WHERE k.\`keep_id\` IS NULL
        AND ac.\`isUsed\` = 0
        AND ac.\`studentId\` IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM \`users\` u WHERE u.\`accessCodeId\` = ac.\`id\`
        )
    `);

    await queryRunner.query(`DROP TEMPORARY TABLE IF EXISTS \`tmp_access_code_keepers\``);

    const remainingDupes: Array<{ code: string; cnt: string | number }> =
      await queryRunner.query(`
        SELECT \`code\`, COUNT(*) AS cnt
        FROM \`access_codes\`
        GROUP BY \`code\`
        HAVING COUNT(*) > 1
      `);

    if (remainingDupes.length > 0) {
      throw new Error(
        `Cannot enforce unique access codes: duplicate codes still remain (${remainingDupes
          .map((row) => String(row.code))
          .join(', ')}). Resolve used/linked duplicates manually first.`,
      );
    }

    const composite = table.uniques.find(
      (u) =>
        u.columnNames.includes('code') && u.columnNames.includes('partnerId'),
    );
    if (composite) {
      await queryRunner.dropUniqueConstraint('access_codes', composite);
    }

    const compositeIndex = table.indices.find(
      (idx) =>
        idx.isUnique &&
        idx.columnNames.length === 2 &&
        idx.columnNames.includes('code') &&
        idx.columnNames.includes('partnerId'),
    );
    if (compositeIndex) {
      await queryRunner.dropIndex('access_codes', compositeIndex);
    }

    const namedComposite: Array<{ index_name: string }> = await queryRunner.query(`
      SELECT INDEX_NAME AS index_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'access_codes'
        AND index_name = 'IDX_access_codes_code_partner'
      LIMIT 1
    `);
    if (namedComposite.length > 0) {
      await queryRunner.query(
        `DROP INDEX \`IDX_access_codes_code_partner\` ON \`access_codes\``,
      );
    }

    const codeUniqueExists: Array<{ index_name: string }> = await queryRunner.query(`
      SELECT INDEX_NAME AS index_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'access_codes'
        AND index_name = 'IDX_access_codes_code'
      LIMIT 1
    `);

    if (codeUniqueExists.length === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX \`IDX_access_codes_code\` ON \`access_codes\` (\`code\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table) return;

    const codeUniqueExists: Array<{ index_name: string }> = await queryRunner.query(`
      SELECT INDEX_NAME AS index_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'access_codes'
        AND index_name = 'IDX_access_codes_code'
      LIMIT 1
    `);
    if (codeUniqueExists.length > 0) {
      await queryRunner.query(
        `DROP INDEX \`IDX_access_codes_code\` ON \`access_codes\``,
      );
    }

    const compositeExists: Array<{ index_name: string }> = await queryRunner.query(`
      SELECT INDEX_NAME AS index_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'access_codes'
        AND index_name = 'IDX_access_codes_code_partner'
      LIMIT 1
    `);
    if (compositeExists.length === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX \`IDX_access_codes_code_partner\`
        ON \`access_codes\` (\`code\`, \`partnerId\`)
      `);
    }
  }
}
