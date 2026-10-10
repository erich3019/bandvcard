namespace Bandvcard.Api.Data;

public interface ICurrentUser
{
    string Name { get; }
}

public class HttpContextCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public const string Fallback = "system";

    // Authentication is not specified yet, so this falls back until it is.
    public string Name => httpContextAccessor.HttpContext?.User.Identity?.Name ?? Fallback;
}
