using Microsoft.AspNetCore.Mvc;

public class DashboardController : Controller
{
    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }
}