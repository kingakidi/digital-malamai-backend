import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class ReplacePlaceholderCategoryIds1784400000002
  implements MigrationInterface
{
  name = 'ReplacePlaceholderCategoryIds1784400000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; slug: string }> = await queryRunner.query(
      `
      SELECT \`id\`, \`slug\`
      FROM \`course_categories\`
      WHERE \`id\` LIKE 'a1000000-%'
      `,
    );

    if (rows.length === 0) {
      return;
    }

    const coursesTable = await queryRunner.getTable('courses');
    const fk = coursesTable?.foreignKeys.find((item) =>
      item.columnNames.includes('categoryId'),
    );
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` DROP FOREIGN KEY \`${fk.name}\``,
      );
    }

    for (const row of rows) {
      const nextId = uuidv4();
      await queryRunner.query(
        `UPDATE \`courses\` SET \`categoryId\` = ? WHERE \`categoryId\` = ?`,
        [nextId, row.id],
      );
      await queryRunner.query(
        `UPDATE \`course_categories\` SET \`id\` = ? WHERE \`id\` = ?`,
        [nextId, row.id],
      );
    }

    await queryRunner.query(`
      ALTER TABLE \`courses\`
      ADD CONSTRAINT \`FK_courses_categoryId\`
      FOREIGN KEY (\`categoryId\`) REFERENCES \`course_categories\`(\`id\`)
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(): Promise<void> {}
}
