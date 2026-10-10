using System.Security.Claims;
using Bandvcard.Api.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bandvcard.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IAuthenticationSchemeProvider schemes,
    IWebHostEnvironment environment) : ControllerBase
{
    // Tells the frontend whether there is a login at all and which one.
    [AllowAnonymous]
    [HttpGet("mode")]
    public async Task<IActionResult> Mode() => Ok(new { mode = await GetModeAsync() });

    private async Task<string> GetModeAsync() =>
        environment.IsDevelopment() ? "development"
        : await schemes.GetSchemeAsync(OpenIdConnectDefaults.AuthenticationScheme) is not null ? "microsoft"
        : "none";

    // Sends the browser to Microsoft; after a successful login it returns to returnUrl.
    [AllowAnonymous]
    [HttpGet("login")]
    public async Task<IActionResult> Login(string? returnUrl)
    {
        var target = Url.IsLocalUrl(returnUrl) ? returnUrl : "/";
        switch (await GetModeAsync())
        {
            case "development":
                // Nobody needs to log in here.
                return Redirect(target);
            case "none":
                return Problem(
                    "Login is not configured. Set Entra:TenantId, Entra:ClientId and Entra:ClientSecret.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            default:
                return Challenge(
                    new AuthenticationProperties { RedirectUri = target },
                    OpenIdConnectDefaults.AuthenticationScheme);
        }
    }

    [HttpGet("me")]
    public IActionResult Me() => Ok(new
    {
        email = User.Identity!.Name,
        firstName = User.FindFirstValue(ClaimTypes.GivenName),
        lastName = User.FindFirstValue(ClaimTypes.Surname),
        role = User.FindFirstValue(ClaimTypes.Role),
        // False in the Development environment, where there is nothing to log in to or out of.
        loginRequired = !environment.IsDevelopment(),
    });

    // Ends the app session only; the Microsoft session stays signed in.
    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (environment.IsDevelopment())
        {
            // There is no session to end.
            return Redirect("/");
        }

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect(AuthSetup.LoginPage);
    }
}
