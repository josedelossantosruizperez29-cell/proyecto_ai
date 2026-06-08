using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Proyecto_ai.Data;
using Proyecto_ai.Models;
using System.Diagnostics;

namespace proyecto_ai.Controllers
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
            return View();
        }

        [HttpPost]
        public IActionResult login(LoginViewModel model)
        {
            var user = _context.Users.FirstOrDefault(u => u.Correo == model.correo);
            if (user == null)
            {
                ViewBag.Error = "El correo o la contraseñas son incorrectos";
                return View("Account");
            }
            var hasher = new PasswordHasher<User>();
            var resultado = hasher.VerifyHashedPassword(user, user.PasswordHash, model.Password);
            if(resultado == PasswordVerificationResult.Failed)
            {
                ViewBag.Error = "El correo o la contraseñas son incorrectos";
                return View("Account");
            }

            return RedirectToAction("Index", "Dashboard");
;
        }
    }
}