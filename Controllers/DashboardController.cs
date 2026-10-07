using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Data;
using Proyecto_ai.Models;

namespace Proyecto_ai.Controllers
{
    [Authorize]
    public class DashboardController : Controller
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var userId = GetUserId();
            if (userId == null)
            {
                return RedirectToAction("Account", "Account");
            }

            var user = await _context.Users
                .Include(u => u.AiPreference)
                .FirstOrDefaultAsync(u => u.Id == userId.Value);

            if (user == null)
            {
                return RedirectToAction("Account", "Account");
            }

            var model = new DashboardViewModel
            {
                Nombre = user.Nombre,
                Apellido = user.Apellido,
                Correo = user.Correo,
                Initials = BuildInitials(user),
                DefaultModelId = user.AiPreference?.DefaultModelId ?? AiModelCatalog.DefaultModelId,
                ThinkingMode = user.AiPreference?.ThinkingMode ?? ThinkingModeCatalog.DefaultMode
            };

            return View(model);
        }

        private long? GetUserId()
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return long.TryParse(value, out var userId) ? userId : null;
        }

        private static string BuildInitials(User user)
        {
            var first = string.IsNullOrWhiteSpace(user.Nombre) ? "E" : user.Nombre.Trim()[0].ToString();
            var last = string.IsNullOrWhiteSpace(user.Apellido) ? "A" : user.Apellido.Trim()[0].ToString();
            return $"{first}{last}".ToUpperInvariant();
        }
    }
}
