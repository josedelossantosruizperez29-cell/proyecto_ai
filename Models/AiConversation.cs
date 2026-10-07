namespace Proyecto_ai.Models
{
    public class AiConversation
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public string Title { get; set; } = "Nuevo chat";
        public string ModelId { get; set; } = AiModelCatalog.DefaultModelId;
        public string ThinkingMode { get; set; } = ThinkingModeCatalog.DefaultMode;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public User User { get; set; } = null!;
        public ICollection<AiMessage> Messages { get; set; } = new List<AiMessage>();
    }
}
