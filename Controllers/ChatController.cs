using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Data;
using Proyecto_ai.Models;
using Proyecto_ai.Services;

namespace Proyecto_ai.Controllers
{
    [Authorize]
    [Route("api/chat")]
    public class ChatController : Controller
    {
        private readonly AppDbContext _context;
        private readonly IAiChatService _aiChatService;
        private readonly ILogger<ChatController> _logger;

        public ChatController(AppDbContext context, IAiChatService aiChatService, ILogger<ChatController> logger)
        {
            _context = context;
            _aiChatService = aiChatService;
            _logger = logger;
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> Conversations()
        {
            var userId = GetUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var conversations = await _context.AiConversations
                .Where(conversation => conversation.UserId == userId.Value)
                .OrderByDescending(conversation => conversation.UpdatedAt)
                .Take(40)
                .Select(conversation => new ConversationDto(
                    conversation.Id,
                    conversation.Title,
                    conversation.ModelId,
                    conversation.ThinkingMode,
                    conversation.UpdatedAt))
                .ToListAsync();

            return Ok(conversations);
        }

        [HttpGet("conversations/{conversationId:long}/messages")]
        public async Task<IActionResult> Messages(long conversationId)
        {
            var userId = GetUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var exists = await _context.AiConversations.AnyAsync(c => c.Id == conversationId && c.UserId == userId.Value);
            if (!exists)
            {
                return NotFound();
            }

            var messages = await _context.AiMessages
                .Where(message => message.ConversationId == conversationId)
                .OrderBy(message => message.CreatedAt)
                .Select(message => new ChatMessageDto(message.Id, message.Role, message.Content, message.ModelId, message.CreatedAt))
                .ToListAsync();

            return Ok(messages);
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] SendMessageRequest request, CancellationToken cancellationToken)
        {
            var userId = GetUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            request.Message = request.Message?.Trim() ?? string.Empty;
            request.ModelId = request.ModelId?.Trim() ?? string.Empty;
            request.ThinkingMode = request.ThinkingMode?.Trim() ?? string.Empty;

            if (!ModelState.IsValid || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "Escribe un mensaje valido." });
            }

            if (!AiModelCatalog.IsSupported(request.ModelId))
            {
                return BadRequest(new { error = "Modelo no permitido." });
            }

            if (!ThinkingModeCatalog.IsSupported(request.ThinkingMode))
            {
                return BadRequest(new { error = "Modo de pensamiento no permitido." });
            }

            var conversation = request.ConversationId.HasValue
                ? await _context.AiConversations
                    .Include(c => c.Messages)
                    .FirstOrDefaultAsync(c => c.Id == request.ConversationId.Value && c.UserId == userId.Value, cancellationToken)
                : null;

            if (request.ConversationId.HasValue && conversation == null)
            {
                return NotFound(new { error = "La conversacion no existe." });
            }

            if (conversation == null)
            {
                conversation = new AiConversation
                {
                    UserId = userId.Value,
                    Title = BuildTitle(request.Message),
                    ModelId = request.ModelId,
                    ThinkingMode = request.ThinkingMode
                };
                _context.AiConversations.Add(conversation);
            }

            var history = conversation.Messages
                .OrderBy(message => message.CreatedAt)
                .TakeLast(12)
                .ToList();

            var userMessage = new AiMessage
            {
                Conversation = conversation,
                Role = "user",
                Content = request.Message,
                ModelId = request.ModelId,
                TokensApprox = EstimateTokens(request.Message),
                CreatedAt = DateTime.UtcNow
            };

            conversation.ModelId = request.ModelId;
            conversation.ThinkingMode = request.ThinkingMode;
            conversation.UpdatedAt = DateTime.UtcNow;
            conversation.Messages.Add(userMessage);

            await UpsertPreferenceAsync(userId.Value, request.ModelId, request.ThinkingMode, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                var assistantText = await _aiChatService.CompleteAsync(
                    history,
                    request.Message,
                    request.ModelId,
                    request.ThinkingMode,
                    cancellationToken);

                var assistantMessage = new AiMessage
                {
                    ConversationId = conversation.Id,
                    Role = "assistant",
                    Content = assistantText,
                    ModelId = request.ModelId,
                    TokensApprox = EstimateTokens(assistantText),
                    CreatedAt = DateTime.UtcNow
                };

                _context.AiMessages.Add(assistantMessage);
                conversation.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);

                return Ok(new SendMessageResponse(
                    conversation.Id,
                    conversation.Title,
                    ToDto(userMessage),
                    ToDto(assistantMessage)));
            }
            catch (Exception ex) when (ex is InvalidOperationException or HttpRequestException or TaskCanceledException)
            {
                _logger.LogWarning(ex, "AI response failed.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    error = ex is InvalidOperationException ? ex.Message : "La IA tardo demasiado o no esta disponible. Intenta de nuevo con modo Rapido."
                });
            }
        }

        [HttpDelete("conversations/{conversationId:long}")]
        public async Task<IActionResult> Delete(long conversationId)
        {
            var userId = GetUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var conversation = await _context.AiConversations.FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId.Value);
            if (conversation == null)
            {
                return NotFound();
            }

            _context.AiConversations.Remove(conversation);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task UpsertPreferenceAsync(long userId, string modelId, string thinkingMode, CancellationToken cancellationToken)
        {
            var preference = await _context.UserAiPreferences.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
            if (preference == null)
            {
                _context.UserAiPreferences.Add(new UserAiPreference
                {
                    UserId = userId,
                    DefaultModelId = modelId,
                    ThinkingMode = thinkingMode,
                    UpdatedAt = DateTime.UtcNow
                });
                return;
            }

            preference.DefaultModelId = modelId;
            preference.ThinkingMode = thinkingMode;
            preference.UpdatedAt = DateTime.UtcNow;
        }

        private long? GetUserId()
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return long.TryParse(value, out var userId) ? userId : null;
        }

        private static string BuildTitle(string message)
        {
            var title = message.ReplaceLineEndings(" ").Trim();
            return title.Length <= 60 ? title : $"{title[..57]}...";
        }

        private static int EstimateTokens(string text) =>
            Math.Max(1, (int)Math.Ceiling(text.Length / 4.0));

        private static ChatMessageDto ToDto(AiMessage message) =>
            new(message.Id, message.Role, message.Content, message.ModelId, message.CreatedAt);
    }
}
