namespace Bandvcard.Api.Entities;

// Audit fields are set by BandvcardDbContext on save, never by callers.
public interface IAuditable
{
    DateTimeOffset CreatedAt { get; set; }
    string CreatedBy { get; set; }
    DateTimeOffset UpdatedAt { get; set; }
    string UpdatedBy { get; set; }
}
