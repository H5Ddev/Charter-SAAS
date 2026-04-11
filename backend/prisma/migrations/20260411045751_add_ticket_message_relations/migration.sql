BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE NONCLUSTERED INDEX [ticket_messages_userId_idx] ON [dbo].[ticket_messages]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ticket_messages_contactId_idx] ON [dbo].[ticket_messages]([contactId]);

-- AddForeignKey
ALTER TABLE [dbo].[ticket_messages] ADD CONSTRAINT [ticket_messages_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ticket_messages] ADD CONSTRAINT [ticket_messages_contactId_fkey] FOREIGN KEY ([contactId]) REFERENCES [dbo].[contacts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
