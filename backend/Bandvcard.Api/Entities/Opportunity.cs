namespace Bandvcard.Api.Entities;

// A sales opportunity noted for a contact; a contact can have any number of them.
public class Opportunity : IAuditable
{
    public const int MaxTextLength = 200;

    public Guid Id { get; set; }
    public Guid ContactId { get; set; }
    public Contact? Contact { get; set; }
    public string Text { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = "";
}
