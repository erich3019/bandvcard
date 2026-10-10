using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bandvcard.Api.Auth;

public class UserSignInService(BandvcardDbContext db)
{
    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    // Returns the user for a successful identity provider login, creating it on first login.
    // Returns null if the user exists but is inactive.
    public async Task<User?> SignInAsync(string email, string? firstName, string? lastName)
    {
        email = NormalizeEmail(email);
        var user = await db.Users.FindAsync(email);
        if (user is null)
        {
            user = new User
            {
                Email = email,
                FirstName = firstName ?? "",
                LastName = lastName ?? "",
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        return user.Status == UserStatus.Active ? user : null;
    }

    public Task<bool> IsActiveAsync(string email) =>
        db.Users.AnyAsync(u => u.Email == email && u.Status == UserStatus.Active);
}
