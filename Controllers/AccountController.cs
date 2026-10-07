using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Data;
using Proyecto_ai.Models;

namespace Proyecto_ai.Controllers
{
    public class AccountController : Controller
    {
        private readonly AppDbContext _context;

        public AccountController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Account()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "Dashboard");
            }

            return View(new LoginViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View("Account", model);
            }

            var email = model.Correo.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Correo == email);
            if (user == null)
            {
                ModelState.AddModelError(string.Empty, "El correo o la contrasena son incorrectos.");
                return View("Account", model);
            }

            var hasher = new PasswordHasher<User>();
            var result = hasher.VerifyHashedPassword(user, user.PasswordHash, model.Password);
            if (result == PasswordVerificationResult.Failed)
            {
                ModelState.AddModelError(string.Empty, "El correo o la contrasena son incorrectos.");
                return View("Account", model);
            }

            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await SignInAsync(user);
            return RedirectToAction("Index", "Dashboard");
        }

        [Authorize]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync("EmmaCookie");
            return RedirectToAction("Index", "Home");
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { error = "Revisa nombre y apellido." });
            }

            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized();
            }

            user.Nombre = request.Nombre.Trim();
            user.Apellido = request.Apellido.Trim();
            await _context.SaveChangesAsync();
            await SignInAsync(user);

            return Ok(new
            {
                user.Nombre,
                user.Apellido,
                user.Correo,
                initials = BuildInitials(user)
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { error = "La nueva contrasena debe tener minimo 8 caracteres y coincidir." });
            }

            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized();
            }

            var hasher = new PasswordHasher<User>();
            var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
            if (result == PasswordVerificationResult.Failed)
            {
                return BadRequest(new { error = "La contrasena actual no es correcta." });
            }

            user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Contrasena actualizada." });
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return long.TryParse(idValue, out var userId)
                ? await _context.Users.FindAsync(userId)
                : null;
        }

        private async Task SignInAsync(User user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, $"{user.Nombre} {user.Apellido}".Trim()),
                new(ClaimTypes.Email, user.Correo)
            };

            var identity = new ClaimsIdentity(claims, "EmmaCookie");
            var principal = new ClaimsPrincipal(identity);
            await HttpContext.SignInAsync("EmmaCookie", principal);
        }

        private static string BuildInitials(User user)
        {
            var first = string.IsNullOrWhiteSpace(user.Nombre) ? "E" : user.Nombre.Trim()[0].ToString();
            var last = string.IsNullOrWhiteSpace(user.Apellido) ? "A" : user.Apellido.Trim()[0].ToString();
            return $"{first}{last}".ToUpperInvariant();
        }
    }
}
