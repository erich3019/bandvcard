namespace Bandvcard.Api.Entities;

// Ortsverzeichnis: normalises postal codes and place names.
public class PostalCodeEntry
{
    public required string PostalCode { get; set; }
    public required string PlaceName { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }

    public ICollection<Contact> Contacts { get; } = [];
}
