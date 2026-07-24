import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

const SEEDED_CATEGORIES = [
  { name: 'General', slug: 'general', isDefault: 1 },
  {
    name: 'Microsoft Office Proficiency',
    slug: 'microsoft-office-proficiency',
    isDefault: 0,
  },
  {
    name: 'Online Collaboration with Google Workspace',
    slug: 'online-collaboration-google-workspace',
    isDefault: 0,
  },
  {
    name: 'Digital Content Creation for Educators',
    slug: 'digital-content-creation-for-educators',
    isDefault: 0,
  },
  {
    name: 'Using AI for Teachers and Students',
    slug: 'using-ai-for-teachers-and-students',
    isDefault: 0,
  },
] as const;

export class CourseCategories1784400000001 implements MigrationInterface {
  name = 'CourseCategories1784400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const categoriesTable = await queryRunner.getTable('course_categories');
    if (!categoriesTable) {
      await queryRunner.query(`
        CREATE TABLE \`course_categories\` (
          \`id\` varchar(36) NOT NULL,
          \`name\` varchar(255) NOT NULL,
          \`slug\` varchar(255) NOT NULL,
          \`iconUrl\` varchar(500) NULL,
          \`isDefault\` tinyint NOT NULL DEFAULT 0,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          UNIQUE INDEX \`IDX_course_categories_slug\` (\`slug\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    const categoryIds: Record<string, string> = {};
    for (const item of SEEDED_CATEGORIES) {
      const existing = await queryRunner.query(
        `SELECT \`id\` FROM \`course_categories\` WHERE \`slug\` = ? LIMIT 1`,
        [item.slug],
      );

      if (existing[0]?.id) {
        categoryIds[item.slug] = existing[0].id as string;
        await queryRunner.query(
          `
          UPDATE \`course_categories\`
          SET \`name\` = ?, \`isDefault\` = ?
          WHERE \`slug\` = ?
          `,
          [item.name, item.isDefault, item.slug],
        );
        continue;
      }

      const id = uuidv4();
      categoryIds[item.slug] = id;
      await queryRunner.query(
        `
        INSERT INTO \`course_categories\`
          (\`id\`, \`name\`, \`slug\`, \`iconUrl\`, \`isDefault\`)
        VALUES (?, ?, ?, NULL, ?)
        `,
        [id, item.name, item.slug, item.isDefault],
      );
    }

    const generalId = categoryIds.general;
    const coursesTable = await queryRunner.getTable('courses');
    if (coursesTable && !coursesTable.findColumnByName('categoryId')) {
      await queryRunner.query(`
        ALTER TABLE \`courses\`
        ADD \`categoryId\` varchar(36) NULL
      `);
    }

    await queryRunner.query(
      `
      UPDATE \`courses\`
      SET \`categoryId\` = ?
      WHERE \`categoryId\` IS NULL
      `,
      [generalId],
    );

    await queryRunner.query(`
      ALTER TABLE \`courses\`
      MODIFY \`categoryId\` varchar(36) NOT NULL
    `);

    const updatedCourses = await queryRunner.getTable('courses');
    const hasFk = updatedCourses?.foreignKeys.some((fk) =>
      fk.columnNames.includes('categoryId'),
    );
    if (!hasFk) {
      await queryRunner.query(`
        ALTER TABLE \`courses\`
        ADD CONSTRAINT \`FK_courses_categoryId\`
        FOREIGN KEY (\`categoryId\`) REFERENCES \`course_categories\`(\`id\`)
        ON DELETE RESTRICT ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const coursesTable = await queryRunner.getTable('courses');
    const fk = coursesTable?.foreignKeys.find((item) =>
      item.columnNames.includes('categoryId'),
    );
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE \`courses\` DROP FOREIGN KEY \`${fk.name}\``,
      );
    }

    if (coursesTable?.findColumnByName('categoryId')) {
      await queryRunner.query(`
        ALTER TABLE \`courses\`
        DROP COLUMN \`categoryId\`
      `);
    }

    const categoriesTable = await queryRunner.getTable('course_categories');
    if (categoriesTable) {
      await queryRunner.query(`DROP TABLE \`course_categories\``);
    }
  }
}
