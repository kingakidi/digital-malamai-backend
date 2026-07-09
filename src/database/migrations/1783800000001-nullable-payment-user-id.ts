import { MigrationInterface, QueryRunner } from 'typeorm';

const USER_FK = 'FK_60b852936ca1e980cce98d977a2';

export class NullablePaymentUserId1783800000001 implements MigrationInterface {
  name = 'NullablePaymentUserId1783800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` DROP FOREIGN KEY \`${USER_FK}\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` CHANGE \`userId\` \`userId\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` ADD CONSTRAINT \`${USER_FK}\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` DROP FOREIGN KEY \`${USER_FK}\``,
    );
    await queryRunner.query(
      `UPDATE \`payment_transactions\` SET \`userId\` = (SELECT \`id\` FROM \`users\` LIMIT 1) WHERE \`userId\` IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` CHANGE \`userId\` \`userId\` varchar(36) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` ADD CONSTRAINT \`${USER_FK}\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
