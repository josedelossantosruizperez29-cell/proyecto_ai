namespace Proyecto_ai.Models
{
    public sealed record AiModelOption(string Id, string Name, string Description, string Badge);

    public static class AiModelCatalog
    {
        public const string DefaultModelId = "cohere/north-mini-code:free";

        public static readonly IReadOnlyList<AiModelOption> Models =
        [
            new("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron Super", "Razonamiento fuerte para tareas complejas.", "Profundo"),
            new("poolside/laguna-m.1:free", "Laguna M.1", "Buen equilibrio para ideas, escritura y analisis.", "Balanceado"),
            new("cohere/north-mini-code:free", "North Mini Code", "Rapido y practico para codigo y respuestas cortas.", "Rapido")
        ];

        public static bool IsSupported(string modelId) =>
            Models.Any(model => model.Id.Equals(modelId, StringComparison.OrdinalIgnoreCase));
    }
}
