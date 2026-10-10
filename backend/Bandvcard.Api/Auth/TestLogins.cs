using System.Security.Cryptography;
using System.Text;

namespace Bandvcard.Api.Auth;

// Test accounts from Auth:TestLogins (TEST_LOGINS), written as "email:password,email:password".
// While any are configured, the login asks for email and password instead of going to Microsoft.
// For testing only: the passwords are plain configuration values, so AuthSetup refuses to
// start with them outside the Development environment.
public class TestLogins
{
    public const string Key = "Auth:TestLogins";

    private readonly Dictionary<string, byte[]> _passwordHashes = [];

    public TestLogins(IConfiguration configuration)
    {
        var entries = (configuration[Key] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var entry in entries)
        {
            var separator = entry.IndexOf(':');
            if (separator <= 0 || separator == entry.Length - 1)
            {
                throw new InvalidOperationException(
                    $"{Key} (TEST_LOGINS) must be a comma-separated list of email:password entries.");
            }

            _passwordHashes[UserSignInService.NormalizeEmail(entry[..separator])] = Hash(entry[(separator + 1)..]);
        }
    }

    public bool Enabled => _passwordHashes.Count > 0;

    public IReadOnlyCollection<string> Emails => _passwordHashes.Keys;

    public bool Verify(string? email, string? password)
    {
        if (email is null || password is null)
        {
            return false;
        }

        // Compare against some hash even for unknown addresses, and in constant time,
        // so the response time reveals neither accounts nor passwords.
        var known = _passwordHashes.TryGetValue(UserSignInService.NormalizeEmail(email), out var expected);
        var matches = CryptographicOperations.FixedTimeEquals(Hash(password), expected ?? Hash(""));
        return known && matches;
    }

    private static byte[] Hash(string password) => SHA256.HashData(Encoding.UTF8.GetBytes(password));
}
