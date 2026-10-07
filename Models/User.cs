namespace Proyecto_ai.Models
{
    public class User
    {
        public long Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Apellido { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }

        public ICollection<AiConversation> Conversations { get; set; } = new List<AiConversation>();
        public UserAiPreference? AiPreference { get; set; }
    }
}
