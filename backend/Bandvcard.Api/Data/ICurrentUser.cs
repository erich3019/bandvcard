using Bandvcard.Api.Auth;

namespace Bandvcard.Api.Data;

public interface ICurrentUser
{
    // The email address of the logged-in user.
    string Name { get; }

    bool IsAdmin { get; }
}

public class HttpContextCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    // Used outside of a request, e.g. by tools and background work.
    public const string Fallback = "system";

    public string Name => httpContextAccessor.HttpContext?.User.Identity?.Name ?? Fallback;

    public bool IsAdmin => httpContextAccessor.HttpContext?.User.IsInRole(Roles.Admin) == true;
}
