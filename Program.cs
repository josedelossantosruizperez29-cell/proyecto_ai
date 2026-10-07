using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Data;
using Proyecto_ai.Services;

var builder = WebApplication.CreateBuilder(args);

// Render inyecta $PORT. Sin esto el deploy falla con "port scan timeout".
// Dockerfile tambien pasa --urls, esto es respaldo por si se despliega sin Docker.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://*:{port}");
}

// Render termina TLS en su proxy y reenvia en http interno.
// Sin ForwardedHeaders, UseHttpsRedirection entra en loop y las cookies fallan.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddControllersWithViews();
builder.Services.AddAuthentication("EmmaCookie")
    .AddCookie("EmmaCookie", options =>
    {
        options.LoginPath = "/Account/Account";
        options.LogoutPath = "/Account/Logout";
        options.AccessDeniedPath = "/Account/Account";
        options.Cookie.Name = "emma_ai_session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddHttpClient<IAiChatService, AiChatService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

var app = builder.Build();

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
