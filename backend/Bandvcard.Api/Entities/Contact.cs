namespace Bandvcard.Api.Entities;

// Whether the contact is released for the import into the ERP system Abacus.
public enum AbacusStatus
{
    None,

    // "übernehmen": released by a person, waiting to be imported by Abacus.
    ToImport,

    // "übernommen": transferred to Abacus. Only the import sets this (AbacusController).
    Imported,
}

public class Contact : IAuditable
{
    public Guid Id { get; set; }
    public string? Salutation { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Street { get; set; }
    public string? HouseNumber { get; set; }
    public string? PostalCode { get; set; }
    public PostalCodeEntry? PostalCodeEntry { get; set; }
    public string? City { get; set; }
    public string? CompanyName { get; set; }
    public string? Function { get; set; }
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    // URL or path of the business card photo in MinIO.
    public string? PhotoLink { get; set; }

    public AbacusStatus AbacusStatus { get; set; } = AbacusStatus.None;

    // When the import transferred the contact; set together with AbacusStatus.Imported.
    public DateTimeOffset? AbacusImportedAt { get; set; }

    public ICollection<Opportunity> Opportunities { get; } = [];

    public DateTimeOffset CreatedAt { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = "";
}
