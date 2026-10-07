using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Data;
using Proyecto_ai.Models;

namespace Proyecto_ai.Controllers
{
    public class RegisterController : Controller
    {
        private readonly AppDbContext _context;

        public RegisterController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Register()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "Dashboard");
            }

            return View(new RegisterViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Registrarme(RegisterViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View("Register", model);
            }

            var email = model.Correo.Trim().ToLowerInvariant();
            if (await _context.Users.AnyAsync(u => u.Correo == email))
            {
                ModelState.AddModelError(nameof(model.Correo), "El correo ya esta registrado.");
                return View("Register", model);
            }

            var hasher = new PasswordHasher<User>();
            var user = new User
            {
                Nombre = model.Nombre.Trim(),
                Apellido = model.Apellido.Trim(),
                Correo = email,
                CreatedAt = DateTime.UtcNow
            };

            user.PasswordHash = hasher.HashPassword(user, model.Password);
            user.AiPreference = new UserAiPreference
            {
                DefaultModelId = AiModelCatalog.DefaultModelId,
                ThinkingMode = ThinkingModeCatalog.DefaultMode
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            TempData["Success"] = "Cuenta creada. Inicia sesion para continuar.";
            return RedirectToAction("Account", "Account");
        }
    }
}
