using Bandvcard.Api.Entities;

namespace Bandvcard.Api.Auth;

// Role names as they appear in the session's role claim and in [Authorize(Roles = ...)].
public static class Roles
{
    public const string Admin = nameof(UserRole.Admin);
    public const string User = nameof(UserRole.User);

    // Not a user role: the identity of the API key (see ApiKeyAuthHandler).
    public const string Integration = "Integration";
}

// The addresses from Auth:AdminEmails (ADMIN_EMAILS). They are made admin at every login and
// cannot be demoted in the app, so there is always a way back in.
public class AdminEmails(IConfiguration configuration)
{
    public const string Key = "Auth:AdminEmails";

    private readonly HashSet<string> _emails = (configuration[Key] ?? "")
        .Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(UserSignInService.NormalizeEmail)
        .ToHashSet();

    public bool Contains(string email) => _emails.Contains(UserSignInService.NormalizeEmail(email));
}
