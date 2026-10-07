namespace Proyecto_ai.Models
{
    public sealed record ThinkingModeOption(string Id, string Name, string Description, double Temperature, int MaxTokens);

    public static class ThinkingModeCatalog
    {
        public const string DefaultMode = "rapido";

        public static readonly IReadOnlyList<ThinkingModeOption> Modes =
        [
            new("rapido", "Rapido", "Respuestas directas con poca espera.", 0.35, 5048),
            new("balanceado", "Balanceado", "Buen detalle sin alargar demasiado.", 0.55, 8096),
            new("profundo", "Profundo", "Mas analisis para problemas complejos.", 0.7, 15000)
        ];

        public static ThinkingModeOption Get(string modeId) =>
            Modes.FirstOrDefault(mode => mode.Id.Equals(modeId, StringComparison.OrdinalIgnoreCase)) ?? Modes[0];

        public static bool IsSupported(string modeId) =>
            Modes.Any(mode => mode.Id.Equals(modeId, StringComparison.OrdinalIgnoreCase));
    }
}
