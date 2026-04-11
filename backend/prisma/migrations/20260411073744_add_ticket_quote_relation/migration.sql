BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE NONCLUSTERED INDEX [tickets_tenantId_quoteId_idx] ON [dbo].[tickets]([tenantId], [quoteId]);

-- AddForeignKey
ALTER TABLE [dbo].[tickets] ADD CONSTRAINT [tickets_quoteId_fkey] FOREIGN KEY ([quoteId]) REFERENCES [dbo].[quotes]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
