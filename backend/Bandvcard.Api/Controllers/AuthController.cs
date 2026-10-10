using System.Security.Claims;
using Bandvcard.Api.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Bandvcard.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IAuthenticationSchemeProvider schemes,
    TestLogins testLogins,
    UserSignInService signIn) : ControllerBase
{
    // Tells the login page which login to offer.
    [AllowAnonymous]
    [HttpGet("mode")]
    public async Task<IActionResult> Mode() => Ok(new
    {
        mode = testLogins.Enabled ? "password"
            : await schemes.GetSchemeAsync(OpenIdConnectDefaults.AuthenticationScheme) is not null ? "microsoft"
            : "none",
    });

    // Sends the browser to Microsoft; after a successful login it returns to returnUrl.
    [AllowAnonymous]
    [HttpGet("login")]
    public async Task<IActionResult> Login(string? returnUrl)
    {
        if (testLogins.Enabled)
        {
            return Redirect(AuthSetup.LoginPage);
        }

        if (await schemes.GetSchemeAsync(OpenIdConnectDefaults.AuthenticationScheme) is null)
        {
            return Problem(
                "Login is not configured. Set Entra:TenantId, Entra:ClientId and Entra:ClientSecret, or Auth:TestLogins for testing.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Challenge(
            new AuthenticationProperties { RedirectUri = LocalTarget(returnUrl) },
            OpenIdConnectDefaults.AuthenticationScheme);
    }

    // Test login with email and password (see TestLogins), posted by the form on the login page.
    // From here on it is the same path as after a Microsoft login.
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting(AuthSetup.LoginRateLimit)]
    public async Task<IActionResult> PasswordLogin(
        [FromForm] string? email, [FromForm] string? password, [FromForm] string? returnUrl)
    {
        if (!testLogins.Enabled)
        {
            return NotFound();
        }

        if (!testLogins.Verify(email, password))
        {
            return Redirect($"{AuthSetup.LoginPage}?error=credentials");
        }

        var localPart = email!.Trim().Split('@')[0];
        var user = await signIn.SignInAsync(email, "Test", localPart);
        if (user is null)
        {
            return Redirect($"{AuthSetup.LoginPage}?error=inactive");
        }

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            AuthSetup.CreatePrincipal(user, CookieAuthenticationDefaults.AuthenticationScheme));
        return Redirect(LocalTarget(returnUrl));
    }

    // Never redirect to another site after a login.
    private string LocalTarget(string? returnUrl) => Url.IsLocalUrl(returnUrl) ? returnUrl : "/";

    [HttpGet("me")]
    public IActionResult Me() => Ok(new
    {
        email = User.Identity!.Name,
        firstName = User.FindFirstValue(ClaimTypes.GivenName),
        lastName = User.FindFirstValue(ClaimTypes.Surname),
        role = User.FindFirstValue(ClaimTypes.Role),
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
