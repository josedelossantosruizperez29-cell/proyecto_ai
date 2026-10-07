using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Models;

namespace Proyecto_ai.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<AiConversation> AiConversations => Set<AiConversation>();
        public DbSet<AiMessage> AiMessages => Set<AiMessage>();
        public DbSet<UserAiPreference> UserAiPreferences => Set<UserAiPreference>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("users");
                entity.HasKey(user => user.Id);
                entity.HasIndex(user => user.Correo).IsUnique();
                entity.Property(user => user.Nombre).HasMaxLength(80).IsRequired();
                entity.Property(user => user.Apellido).HasMaxLength(80).IsRequired();
                entity.Property(user => user.Correo).HasMaxLength(180).IsRequired();
                entity.Property(user => user.PasswordHash).HasColumnName("password_hash").HasMaxLength(512).IsRequired();
                entity.Property(user => user.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(user => user.LastLoginAt).HasColumnName("last_login_at");
            });

            modelBuilder.Entity<AiConversation>(entity =>
            {
                entity.ToTable("ai_conversations");
                entity.HasKey(conversation => conversation.Id);
                entity.HasIndex(conversation => new { conversation.UserId, conversation.UpdatedAt });
                entity.Property(conversation => conversation.Title).HasMaxLength(160).IsRequired();
                entity.Property(conversation => conversation.ModelId).HasMaxLength(140).IsRequired();
                entity.Property(conversation => conversation.ThinkingMode).HasMaxLength(40).IsRequired();
                entity.Property(conversation => conversation.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(conversation => conversation.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasOne(conversation => conversation.User)
                    .WithMany(user => user.Conversations)
                    .HasForeignKey(conversation => conversation.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<AiMessage>(entity =>
            {
                entity.ToTable("ai_messages");
                entity.HasKey(message => message.Id);
                entity.HasIndex(message => new { message.ConversationId, message.CreatedAt });
                entity.Property(message => message.Role).HasMaxLength(20).IsRequired();
                entity.Property(message => message.Content).IsRequired();
                entity.Property(message => message.ModelId).HasMaxLength(140).IsRequired();
                entity.Property(message => message.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(message => message.TokensApprox).HasColumnName("tokens_approx");
                entity.HasOne(message => message.Conversation)
                    .WithMany(conversation => conversation.Messages)
                    .HasForeignKey(message => message.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<UserAiPreference>(entity =>
            {
                entity.ToTable("user_ai_preferences");
                entity.HasKey(preference => preference.Id);
                entity.HasIndex(preference => preference.UserId).IsUnique();
                entity.Property(preference => preference.DefaultModelId).HasMaxLength(140).IsRequired();
                entity.Property(preference => preference.ThinkingMode).HasMaxLength(40).IsRequired();
                entity.Property(preference => preference.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("SYSUTCDATETIME()");
                entity.HasOne(preference => preference.User)
                    .WithOne(user => user.AiPreference)
                    .HasForeignKey<UserAiPreference>(preference => preference.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
