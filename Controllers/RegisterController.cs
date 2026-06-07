using Microsoft.AspNetCore.Mvc;
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
    }
}
