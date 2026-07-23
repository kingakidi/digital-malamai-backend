import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Access codes are system-wide. partnerId is optional (legacy ownership only).
 */
export class NullableAccessCodePartnerId1784100000001
  implements MigrationInterface
{
  name = 'NullableAccessCodePartnerId1784100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table) return;

    const partnerFk = table.foreignKeys.find((fk) =>
      fk.columnNames.includes('partnerId'),
    );
    if (partnerFk) {
      await queryRunner.dropForeignKey('access_codes', partnerFk);
    }

    await queryRunner.query(`
      ALTER TABLE \`access_codes\`
      MODIFY \`partnerId\` varchar(36) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`access_codes\`
      ADD CONSTRAINT \`FK_access_codes_partner\`
      FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('access_codes');
    if (!table) return;

    const partnerFk = table.foreignKeys.find((fk) =>
      fk.columnNames.includes('partnerId'),
    );
    if (partnerFk) {
      await queryRunner.dropForeignKey('access_codes', partnerFk);
    }

    // Assign orphaned codes to the oldest partner so NOT NULL can be restored.
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

    await queryRunner.query(`
      ALTER TABLE \`access_codes\`
      ADD CONSTRAINT \`FK_access_codes_partner\`
      FOREIGN KEY (\`partnerId\`) REFERENCES \`partners\`(\`id\`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }
}
