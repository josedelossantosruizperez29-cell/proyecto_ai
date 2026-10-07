using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Proyecto_ai.Data;
using Proyecto_ai.Models;

namespace Proyecto_ai.Controllers
{
    public class RegisterController : Controller
    {
        private readonly AppDbContext _context;
        private readonly ILogger<RegisterController> _logger;

        public RegisterController(AppDbContext context, ILogger<RegisterController> logger)
        {
            _context = context;
            _logger = logger;
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
            try
            {
                if (await _context.Users.AnyAsync(u => u.Correo == email))
                {
                    ModelState.AddModelError(nameof(model.Correo), "Este correo ya tiene una cuenta. Inicia sesion.");
                    return View("Register", model);
                }

                var hasher = new PasswordHasher<User>();
                var user = new User
                {
                    Nombre = model.Nombre.Trim(),
                    Apellido = model.Apellido.Trim(),
                    Correo = email,
                    CreatedAt = DateTime.UtcNow,
                    AiPreference = new UserAiPreference
                    {
                        DefaultModelId = AiModelCatalog.DefaultModelId,
                        ThinkingMode = ThinkingModeCatalog.DefaultMode
                    }
                };

                user.PasswordHash = hasher.HashPassword(user, model.Password);
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException exception) when (IsUniqueEmailViolation(exception))
            {
                ModelState.AddModelError(nameof(model.Correo), "Este correo ya tiene una cuenta. Inicia sesion.");
                return View("Register", model);
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "No fue posible completar el registro de una cuenta.");
                ModelState.AddModelError(string.Empty, "No pudimos crear tu cuenta en este momento. Intenta de nuevo en unos minutos.");
                return View("Register", model);
            }

            TempData["Success"] = "Cuenta creada. Inicia sesion para continuar.";
            return RedirectToAction("Account", "Account");
        }

        private static bool IsUniqueEmailViolation(DbUpdateException exception)
        {
            var sqlException = exception.GetBaseException() as SqlException;
            return sqlException?.Number is 2601 or 2627;
        }
    }
}
