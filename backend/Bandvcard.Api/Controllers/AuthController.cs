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
    IConfiguration configuration,
    IWebHostEnvironment environment,
    UserSignInService signIn) : ControllerBase
{
    // Sends the browser to Microsoft; after a successful login it returns to returnUrl.
    [AllowAnonymous]
    [HttpGet("login")]
    public async Task<IActionResult> Login(string? returnUrl)
    {
        var target = Url.IsLocalUrl(returnUrl) ? returnUrl : "/";

        if (environment.IsDevelopment() && AuthSetup.GetDevLoginEmail(configuration) is { } devEmail)
        {
            // Same path as after a Microsoft login, minus Microsoft.
            var user = await signIn.SignInAsync(devEmail, "Dev", "Login");
            if (user is null)
            {
                return Redirect($"{AuthSetup.LoginPage}?error=inactive");
            }

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                AuthSetup.CreatePrincipal(user, CookieAuthenticationDefaults.AuthenticationScheme));
            return Redirect(target);
        }

        if (await schemes.GetSchemeAsync(OpenIdConnectDefaults.AuthenticationScheme) is null)
        {
            return Problem(
                "Login is not configured. Set Entra:TenantId, Entra:ClientId and Entra:ClientSecret, or Auth:DevLoginEmail for testing.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Challenge(
            new AuthenticationProperties { RedirectUri = target },
            OpenIdConnectDefaults.AuthenticationScheme);
    }

    [HttpGet("me")]
    public IActionResult Me() => Ok(new
    {
        email = User.Identity!.Name,
        firstName = User.FindFirstValue(ClaimTypes.GivenName),
        lastName = User.FindFirstValue(ClaimTypes.Surname),
    });

    // Ends the app session only; the Microsoft session stays signed in.
    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect(AuthSetup.LoginPage);
    }
}
