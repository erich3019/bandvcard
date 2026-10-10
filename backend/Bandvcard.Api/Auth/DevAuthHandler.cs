using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Bandvcard.Api.Auth;

// Development only: there is no login. Every request is the developer user from
// Auth:DevUserEmail (DEV_USER_EMAIL), which is stored in the user table like any other user.
// AuthSetup registers this scheme only in the Development environment.
public class DevAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IConfiguration configuration,
    UserSignInService signIn) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Development";
    public const string EmailKey = "Auth:DevUserEmail";
    public const string DefaultEmail = "dev@example.com";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var email = configuration[EmailKey] is { Length: > 0 } configured ? configured : DefaultEmail;
        var user = await signIn.SignInAsync(email, "Dev", "User");
        if (user is null)
        {
            return AuthenticateResult.Fail($"The developer user {email} is inactive.");
        }

        return AuthenticateResult.Success(
            new AuthenticationTicket(AuthSetup.CreatePrincipal(user, SchemeName), SchemeName));
    }
}
