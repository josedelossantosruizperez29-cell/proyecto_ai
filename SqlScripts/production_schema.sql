USE [Emma_data];
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users
    (
        Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
        Nombre NVARCHAR(80) NOT NULL,
        Apellido NVARCHAR(80) NOT NULL,
        Correo NVARCHAR(180) NOT NULL,
        password_hash NVARCHAR(512) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
        last_login_at DATETIME2 NULL
    );
END;
GO

IF COL_LENGTH('dbo.users', 'last_login_at') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD last_login_at DATETIME2 NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_users_Correo' AND object_id = OBJECT_ID(N'dbo.users'))
BEGIN
    CREATE UNIQUE INDEX IX_users_Correo ON dbo.users(Correo);
END;
GO

IF OBJECT_ID(N'dbo.ai_conversations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_conversations
    (
        Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ai_conversations PRIMARY KEY,
        UserId BIGINT NOT NULL,
        Title NVARCHAR(160) NOT NULL,
        ModelId NVARCHAR(140) NOT NULL,
        ThinkingMode NVARCHAR(40) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_ai_conversations_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_ai_conversations_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ai_conversations_users_UserId FOREIGN KEY (UserId)
            REFERENCES dbo.users(Id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ai_conversations_UserId_UpdatedAt' AND object_id = OBJECT_ID(N'dbo.ai_conversations'))
BEGIN
    CREATE INDEX IX_ai_conversations_UserId_UpdatedAt ON dbo.ai_conversations(UserId, updated_at DESC);
END;
GO

IF OBJECT_ID(N'dbo.ai_messages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_messages
    (
        Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ai_messages PRIMARY KEY,
        ConversationId BIGINT NOT NULL,
        Role NVARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        ModelId NVARCHAR(140) NOT NULL,
        tokens_approx INT NOT NULL CONSTRAINT DF_ai_messages_tokens_approx DEFAULT 0,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_ai_messages_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ai_messages_ai_conversations_ConversationId FOREIGN KEY (ConversationId)
            REFERENCES dbo.ai_conversations(Id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ai_messages_ConversationId_CreatedAt' AND object_id = OBJECT_ID(N'dbo.ai_messages'))
BEGIN
    CREATE INDEX IX_ai_messages_ConversationId_CreatedAt ON dbo.ai_messages(ConversationId, created_at);
END;
GO

IF OBJECT_ID(N'dbo.user_ai_preferences', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_ai_preferences
    (
        Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_user_ai_preferences PRIMARY KEY,
        UserId BIGINT NOT NULL,
        DefaultModelId NVARCHAR(140) NOT NULL,
        ThinkingMode NVARCHAR(40) NOT NULL,
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_user_ai_preferences_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_ai_preferences_users_UserId FOREIGN KEY (UserId)
            REFERENCES dbo.users(Id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_user_ai_preferences_UserId' AND object_id = OBJECT_ID(N'dbo.user_ai_preferences'))
BEGIN
    CREATE UNIQUE INDEX IX_user_ai_preferences_UserId ON dbo.user_ai_preferences(UserId);
END;
GO

INSERT INTO dbo.user_ai_preferences (UserId, DefaultModelId, ThinkingMode)
SELECT u.Id, N'cohere/north-mini-code:free', N'rapido'
FROM dbo.users AS u
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.user_ai_preferences AS p
    WHERE p.UserId = u.Id
);
GO
