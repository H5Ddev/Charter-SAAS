/**
 * db-nuke.ts
 *
 * Drops ALL objects in the dbo schema in the correct order:
 *   1. Foreign key constraints
 *   2. Default constraints
 *   3. Tables
 *
 * Used by the db-reset GitHub Actions workflow before prisma db push,
 * because SQL Server refuses to drop columns/tables that have constraints.
 *
 * Run: ts-node --transpile-only scripts/db-nuke.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function nukeDatabase() {
  console.log('\n💣  Nuking database schema...\n')

  // 1. Drop all foreign key constraints
  await prisma.$executeRawUnsafe(`
    DECLARE @sql NVARCHAR(MAX) = N''
    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
    FROM sys.foreign_keys
    IF LEN(@sql) > 0 EXEC sp_executesql @sql
  `)
  console.log('   ✓ Foreign key constraints dropped')

  // 2. Drop all default constraints
  await prisma.$executeRawUnsafe(`
    DECLARE @sql NVARCHAR(MAX) = N''
    SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
    FROM sys.default_constraints
    IF LEN(@sql) > 0 EXEC sp_executesql @sql
  `)
  console.log('   ✓ Default constraints dropped')

  // 3. Drop all user tables
  await prisma.$executeRawUnsafe(`
    DECLARE @sql NVARCHAR(MAX) = N''
    SELECT @sql += N'DROP TABLE ' + QUOTENAME(TABLE_SCHEMA)
      + N'.' + QUOTENAME(TABLE_NAME) + N';'
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    IF LEN(@sql) > 0 EXEC sp_executesql @sql
  `)
  console.log('   ✓ All tables dropped')

  console.log('\n✅  Database is empty — ready for prisma db push\n')
}

nukeDatabase()
  .catch((e) => {
    console.error('❌  Nuke failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
