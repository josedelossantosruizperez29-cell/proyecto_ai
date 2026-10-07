namespace Proyecto_ai.Models
{
    public class UserAiPreference
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public string DefaultModelId { get; set; } = AiModelCatalog.DefaultModelId;
        public string ThinkingMode { get; set; } = ThinkingModeCatalog.DefaultMode;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public User User { get; set; } = null!;
    }
}
