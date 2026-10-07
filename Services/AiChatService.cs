using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Proyecto_ai.Models;

namespace Proyecto_ai.Services
{
    public interface IAiChatService
    {
        Task<string> CompleteAsync(
            IReadOnlyList<AiMessage> history,
            string userMessage,
            string modelId,
            string thinkingMode,
            CancellationToken cancellationToken);
    }

    public sealed class AiChatService : IAiChatService
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AiChatService> _logger;

        public AiChatService(HttpClient httpClient, IConfiguration configuration, ILogger<AiChatService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<string> CompleteAsync(
            IReadOnlyList<AiMessage> history,
            string userMessage,
            string modelId,
            string thinkingMode,
            CancellationToken cancellationToken)
        {
            if (!AiModelCatalog.IsSupported(modelId))
            {
                throw new ArgumentException("Modelo de IA no soportado.", nameof(modelId));
            }

            var apiKey = _configuration["OpenRouter:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                apiKey = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY");
            }

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Falta configurar OPENROUTER_API_KEY para conectar la IA.");
            }

            var mode = ThinkingModeCatalog.Get(thinkingMode);
            var messages = new List<OpenRouterMessage>
            {
                new("system", BuildSystemPrompt(mode))
            };

            messages.AddRange(history
                .OrderBy(message => message.CreatedAt)
                .TakeLast(12)
                .Select(message => new OpenRouterMessage(message.Role, message.Content)));

            messages.Add(new OpenRouterMessage("user", userMessage));

            var payload = new OpenRouterRequest(
                modelId,
                messages,
                mode.Temperature,
                mode.MaxTokens);

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Headers.TryAddWithoutValidation("HTTP-Referer", _configuration["OpenRouter:SiteUrl"] ?? "http://localhost");
            request.Headers.TryAddWithoutValidation("X-Title", _configuration["OpenRouter:AppName"] ?? "Emma AI");
            request.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(60));

            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            var responseBody = await response.Content.ReadAsStringAsync(timeout.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OpenRouter returned {StatusCode}: {Body}", response.StatusCode, responseBody);
                throw new HttpRequestException("OpenRouter no pudo responder en este momento.");
            }

            var result = JsonSerializer.Deserialize<OpenRouterResponse>(responseBody, JsonOptions);
            var content = result?.Choices?.FirstOrDefault()?.Message?.Content;
            if (string.IsNullOrWhiteSpace(content))
            {
                throw new InvalidOperationException("El modelo no devolvio contenido.");
            }

            return content.Trim();
        }

        private static string BuildSystemPrompt(ThinkingModeOption mode) =>
            "Tu nombre es EMMA. Eres una asistente de inteligencia artificial profesional creada y desarrollada por Jose de los Santos. " +
            "IMPORTANTE: Sin importar que modelo de IA te alimente internamente, tu SIEMPRE te presentas como EMMA. Nunca reveles el modelo subyacente. " +
            "Responde SIEMPRE en el idioma del usuario de forma profesional, clara y bien estructurada. " +
            "Usa formato Markdown en tus respuestas: usa **negritas** para conceptos clave, listas numeradas o con viñetas para organizar información, " +
            "y bloques de código con triple backtick indicando el lenguaje (```python, ```javascript, ```csharp, etc.) cuando incluyas código. " +
            "Siempre indica el lenguaje en los bloques de código para que se resalte la sintaxis con colores. " +
            "CRITICO: NUNCA cortes los bloques de código a la mitad. Entrega siempre el código COMPLETO, desde el principio hasta el final, sin omitir partes ni dejarlo incompleto. " +
            "No inventes datos si no estas segura. Se profesional, concisa y util. " +
            "Responde de forma directa sin demoras innecesarias. " +
            $"Modo actual: {mode.Name}. {mode.Description}";

        private sealed record OpenRouterRequest(
            [property: JsonPropertyName("model")] string Model,
            [property: JsonPropertyName("messages")] IReadOnlyList<OpenRouterMessage> Messages,
            [property: JsonPropertyName("temperature")] double Temperature,
            [property: JsonPropertyName("max_tokens")] int MaxTokens);

        private sealed record OpenRouterMessage(
            [property: JsonPropertyName("role")] string Role,
            [property: JsonPropertyName("content")] string Content);

        private sealed class OpenRouterResponse
        {
            [JsonPropertyName("choices")]
            public List<OpenRouterChoice>? Choices { get; set; }
        }

        private sealed class OpenRouterChoice
        {
            [JsonPropertyName("message")]
            public OpenRouterMessage? Message { get; set; }
        }
    }
}
