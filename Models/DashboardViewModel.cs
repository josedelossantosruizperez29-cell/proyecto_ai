namespace Proyecto_ai.Models
{
    public class DashboardViewModel
    {
        public string Nombre { get; set; } = string.Empty;
        public string Apellido { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string Initials { get; set; } = "EA";
        public string DefaultModelId { get; set; } = AiModelCatalog.DefaultModelId;
        public string ThinkingMode { get; set; } = ThinkingModeCatalog.DefaultMode;
        public IReadOnlyList<AiModelOption> Models { get; set; } = AiModelCatalog.Models;
        public IReadOnlyList<ThinkingModeOption> ThinkingModes { get; set; } = ThinkingModeCatalog.Modes;
    }
}
