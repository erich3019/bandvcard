namespace Bandvcard.Api.Entities;

public enum UserStatus
{
    Active,
    Inactive,
}

public class User
{
    // The email address is the user's unique identity and primary key.
    public required string Email { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public string? Phone { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
}
