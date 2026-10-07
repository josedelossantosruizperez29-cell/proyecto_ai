using System.ComponentModel.DataAnnotations;

namespace Proyecto_ai.Models
{
    public sealed class SendMessageRequest
    {
        public long? ConversationId { get; set; }

        [Required]
        [StringLength(12000, MinimumLength = 1)]
        public string Message { get; set; } = string.Empty;

        [Required]
        public string ModelId { get; set; } = AiModelCatalog.DefaultModelId;

        [Required]
        public string ThinkingMode { get; set; } = ThinkingModeCatalog.DefaultMode;
    }

    public sealed record ChatMessageDto(long Id, string Role, string Content, string ModelId, DateTime CreatedAt);

    public sealed record ConversationDto(long Id, string Title, string ModelId, string ThinkingMode, DateTime UpdatedAt);

    public sealed record SendMessageResponse(long ConversationId, string Title, ChatMessageDto UserMessage, ChatMessageDto AssistantMessage);

    public sealed class UpdateProfileRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Apellido { get; set; } = string.Empty;
    }

    public sealed class ChangePasswordRequest
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;

        [Required]
        [Compare(nameof(NewPassword))]
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}
