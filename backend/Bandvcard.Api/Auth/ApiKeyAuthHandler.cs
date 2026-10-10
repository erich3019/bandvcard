using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Bandvcard.Api.Auth;

// Machine access for the import into Abacus (an n8n workflow): a request that carries the key
// from Integration:ApiKey (ABACUS_API_KEY) in the X-Api-Key header is the integration, in every
// environment. The integration is not a user: it only reads, and only contacts released for
// Abacus (see ContactVisibility and the write block in Program.cs).
public class ApiKeyAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IConfiguration configuration) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ApiKey";
    public const string Header = "X-Api-Key";
    public const string ConfigurationKey = "Integration:ApiKey";
    public const string IdentityName = "abacus-import";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var expected = configuration[ConfigurationKey];
        var presented = Request.Headers[Header].ToString();
        // Hashing first makes the comparison constant-time regardless of the lengths.
        if (string.IsNullOrEmpty(expected)
            || !CryptographicOperations.FixedTimeEquals(Hash(presented), Hash(expected)))
        {
            return Task.FromResult(AuthenticateResult.Fail("Unknown API key."));
        }

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, IdentityName), new Claim(ClaimTypes.Role, Roles.Integration)],
            SchemeName);
        return Task.FromResult(AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }

    private static byte[] Hash(string value) => SHA256.HashData(Encoding.UTF8.GetBytes(value));
}
