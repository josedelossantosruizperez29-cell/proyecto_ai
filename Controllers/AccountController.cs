using Microsoft.AspNetCore.Mvc;
using Proyecto_ai.Models;
using System.Diagnostics;

namespace proyecto_ai.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet]
        public IActionResult Account()
        {
            return View();
        }



    [HttpGet]
    public IActionResult Register()
    {
        return View();
    }
    }
}