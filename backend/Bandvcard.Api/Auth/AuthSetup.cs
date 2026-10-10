using System.Security.Claims;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Bandvcard.Api.Auth;

public static class AuthSetup
{
    public const string CookieName = "bandvcard.auth";
    public const string LoginPage = "/login";
    private const string SelectorScheme = "Bandvcard";

    // Keep the session cookie small: only what the app needs.
    public static ClaimsPrincipal CreatePrincipal(User user, string? authenticationType) =>
        new(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.Name, user.Email),
                new Claim(ClaimTypes.GivenName, user.FirstName),
                new Claim(ClaimTypes.Surname, user.LastName),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
            ],
            authenticationType));

    // Development: no login at all (DevAuthHandler).
    // Every other environment: login in the backend via OpenID Connect against Microsoft Entra ID,
    // then a session cookie. nginx serves frontend and API on one origin, so the cookie covers both.
    public static void AddBandvcardAuth(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        services.AddSingleton<AdminEmails>();
        services.AddScoped<UserSignInService>();

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        var development = builder.Environment.IsDevelopment();
        var interactiveScheme = development ? DevAuthHandler.SchemeName : CookieAuthenticationDefaults.AuthenticationScheme;
        var authentication = services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = SelectorScheme;
                options.DefaultSignInScheme = interactiveScheme;
            })
            // A request with an API key is the integration and nothing else; a wrong key must
            // not fall back to the login of the browser or, in Development, to the developer user.
            .AddPolicyScheme(SelectorScheme, null, options => options.ForwardDefaultSelector = context =>
                context.Request.Headers.ContainsKey(ApiKeyAuthHandler.Header) ? ApiKeyAuthHandler.SchemeName : interactiveScheme)
            .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthHandler>(ApiKeyAuthHandler.SchemeName, null);

        if (development)
        {
            // No login while developing: every request is the developer user.
            authentication.AddScheme<AuthenticationSchemeOptions, DevAuthHandler>(DevAuthHandler.SchemeName, null);
            return;
        }

        var keysPath = builder.Configuration["DataProtection:KeysPath"];
        if (!string.IsNullOrEmpty(keysPath))
        {
            // Without persisted keys every restart invalidates all session cookies.
            services.AddDataProtection()
                .SetApplicationName("bandvcard")
                .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
        }

        authentication
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                // API clients get status codes; only the login endpoint redirects to Microsoft.
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
                options.Events.OnValidatePrincipal = ValidateSessionAsync;
            });

        var entra = builder.Configuration.GetSection("Entra");
        var tenantId = entra["TenantId"];
        var clientId = entra["ClientId"];
        var clientSecret = entra["ClientSecret"];
        if (!string.IsNullOrEmpty(tenantId) && !string.IsNullOrEmpty(clientId) && !string.IsNullOrEmpty(clientSecret))
        {
            authentication.AddOpenIdConnect(options =>
            {
                options.Authority = $"https://login.microsoftonline.com/{tenantId}/v2.0";
                options.ClientId = clientId;
                options.ClientSecret = clientSecret;
                options.ResponseType = OpenIdConnectResponseType.Code;
                // Query instead of form_post so the correlation cookies can be SameSite=Lax,
                // which also works over plain HTTP in local development.
                options.ResponseMode = OpenIdConnectResponseMode.Query;
                options.CorrelationCookie.SameSite = SameSiteMode.Lax;
                options.NonceCookie.SameSite = SameSiteMode.Lax;
                options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.NonceCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.CallbackPath = "/api/auth/callback";
                options.MapInboundClaims = false;
                options.GetClaimsFromUserInfoEndpoint = true;
                options.SaveTokens = false;
                options.Scope.Clear();
                options.Scope.Add("openid");
                options.Scope.Add("profile");
                options.Scope.Add("email");
                options.Events.OnTicketReceived = SignInUserAsync;
                options.Events.OnRemoteFailure = context =>
                {
                    context.Response.Redirect($"{LoginPage}?error=failed");
                    context.HandleResponse();
                    return Task.CompletedTask;
                };
            });
        }
    }

    private static async Task SignInUserAsync(TicketReceivedContext context)
    {
        var principal = context.Principal!;
        // Single-tenant only: these claims are not safe as an identity across tenants.
        var email = principal.FindFirstValue("email") ?? principal.FindFirstValue("preferred_username");
        if (string.IsNullOrWhiteSpace(email))
        {
            context.Response.Redirect($"{LoginPage}?error=no_email");
            context.HandleResponse();
            return;
        }

        var signIn = context.HttpContext.RequestServices.GetRequiredService<UserSignInService>();
        var user = await signIn.SignInAsync(
            email,
            principal.FindFirstValue("given_name"),
            principal.FindFirstValue("family_name"));
        if (user is null)
        {
            context.Response.Redirect($"{LoginPage}?error=inactive");
            context.HandleResponse();
            return;
        }

        context.Principal = CreatePrincipal(user, principal.Identity!.AuthenticationType);
    }

    // Checked on every request, so deactivating a user or changing their role takes effect
    // immediately instead of at the next login.
    private static async Task ValidateSessionAsync(CookieValidatePrincipalContext context)
    {
        var email = context.Principal?.Identity?.Name;
        var signIn = context.HttpContext.RequestServices.GetRequiredService<UserSignInService>();
        var user = email is null ? null : await signIn.FindActiveAsync(email);
        if (user is null)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        var principal = context.Principal!;
        if (principal.FindFirstValue(ClaimTypes.Role) != user.Role.ToString())
        {
            context.ReplacePrincipal(CreatePrincipal(user, principal.Identity!.AuthenticationType));
            context.ShouldRenew = true;
        }
    }
}
