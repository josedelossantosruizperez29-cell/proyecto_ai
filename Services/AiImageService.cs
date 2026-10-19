using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Proyecto_ai.Models;

namespace Proyecto_ai.Services
{
    public interface IAiImageService
    {
        Task<string> GenerateAsync(string prompt, CancellationToken cancellationToken = default);
    }

    public sealed class AiImageService : IAiImageService
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
        {
        };

        private readonly HttpClient _httpClient;

        public AiImageService(IHttpClientFactory httpClientFactory)
        {
            _httpClient = httpClientFactory.CreateClient("AiImage");
        }

        public async Task<string> GenerateAsync(string prompt, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(prompt))
                throw new ArgumentException("El prompt no puede estar vacío.", nameof(prompt));

            var sanitizedPrompt = Uri.EscapeDataString(prompt.Trim());
            if (sanitizedPrompt.Length > 500)
                sanitizedPrompt = sanitizedPrompt[..500];

            var requestUrl = $"https://image.pollinations.ai/prompt/{sanitizedPrompt}?width=1024&height=1024&model=flux&nologo=true";

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(120));

            using var response = await _httpClient.GetAsync(requestUrl, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new HttpRequestException($"Servicio de imágenes falló ({response.StatusCode}): {errorBody}");
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            // Pollinations returns JSON con la URL de la imagen
            // Formato típico: {"image": "https://..."} o directo el JSON con b64
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("image", out var imgProp) && imgProp.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    return imgProp.GetString()!;
                }
                if (doc.RootElement.TryGetProperty("url", out var urlProp) && urlProp.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    return urlProp.GetString()!;
                }
                // Si el body ya es una URL directa o no hay estructura esperada, retornarlo tal cual (recortado)
                return body.Trim().Trim('"');
            }
            catch
            {
                // Si no es JSON válido, retornar la URL construida como fallback
                return requestUrl;
            }
        }
    }
}