namespace Proyecto_ai.Models
{
    public class AiMessage
    {
        public long Id { get; set; }
        public long ConversationId { get; set; }
        public string Role { get; set; } = "user";
        public string Content { get; set; } = string.Empty;
        public string ModelId { get; set; } = AiModelCatalog.DefaultModelId;
        public int TokensApprox { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public AiConversation Conversation { get; set; } = null!;
    }
}
