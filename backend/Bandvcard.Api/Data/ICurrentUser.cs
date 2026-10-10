using Bandvcard.Api.Auth;

namespace Bandvcard.Api.Data;

public interface ICurrentUser
{
    // The email address of the logged-in user.
    string Name { get; }

    bool IsAdmin { get; }

    // True for the machine access with the API key instead of a person.
    bool IsIntegration => false;
}

public class HttpContextCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    // Used outside of a request, e.g. by tools and background work.
    public const string Fallback = "system";

    public string Name => httpContextAccessor.HttpContext?.User.Identity?.Name ?? Fallback;

    public bool IsAdmin => httpContextAccessor.HttpContext?.User.IsInRole(Roles.Admin) == true;

    public bool IsIntegration => httpContextAccessor.HttpContext?.User.IsInRole(Roles.Integration) == true;
}
