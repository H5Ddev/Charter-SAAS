BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[role_permissions] DROP CONSTRAINT [role_permissions_roleId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[role_permissions] DROP CONSTRAINT [role_permissions_permissionId_fkey];

-- DropTable
DROP TABLE [dbo].[roles];

-- DropTable
DROP TABLE [dbo].[permissions];

-- DropTable
DROP TABLE [dbo].[role_permissions];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
