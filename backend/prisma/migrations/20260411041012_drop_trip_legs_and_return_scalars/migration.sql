BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[trip_legs] DROP CONSTRAINT [trip_legs_tripId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[trip_legs] DROP CONSTRAINT [trip_legs_aircraftId_fkey];

-- AlterTable
ALTER TABLE [dbo].[trips] DROP COLUMN [returnArrivalAt], [returnDepartureAt];

-- DropTable
DROP TABLE [dbo].[trip_legs];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
