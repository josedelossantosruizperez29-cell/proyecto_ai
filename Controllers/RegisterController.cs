using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Proyecto_ai.Data;
using Proyecto_ai.Models;
namespace Proyecto_ai.Controllers
{
    public class registerController : Controller
    {

       private readonly AppDbContext _context;

        public registerController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Register()
        {
            return View();
        }
        [HttpPost]
        public IActionResult Registrarme(RegisterViewModel model)
        {
            if (model.Password == null || model.ConfirPassword == null || model.Nombre == null || model.Apellido == null || model.Correo == null)
            {
                ViewBag.Error = "Todos los campos son obligatorios";
                return View("Register");
            }
             if (_context.Users.Any(u => u.Correo == model.Correo))
            {
                ViewBag.Error = "El correo ya esta registrado";
                return View("Register", model);
            }


            if(model.Password != model.ConfirPassword)
            {
                ViewBag.Error = "Las contraseñas no coinciden";
                return View("Register", model);
            }

            if (model.Password.Length < 8)
            {
                ViewBag.Error = "La contraseñas debe tener al menos 8 caracteres";
                return View("Register", model);
                
            }

            var hasher = new PasswordHasher<User>();
            var user = new User
            {
                Nombre = model.Nombre,
                Apellido = model.Apellido,
                Correo = model.Correo,
            };
            
            user.PasswordHash=hasher.HashPassword(user, model.Password);
            _context.Users.Add(user);
            _context.SaveChanges();
            return RedirectToAction("Account", "Account");
            
        }
    }
}
