using Bandvcard.Api.Entities;

namespace Bandvcard.Api.Data;

// The one place that decides which contacts the caller may work with. Everything that
// reaches contacts or things belonging to them (opportunities, photos) goes through this.
public class ContactVisibility(BandvcardDbContext db, ICurrentUser currentUser)
{
    public IQueryable<Contact> Contacts =>
        // Admins: all contacts.
        currentUser.IsAdmin ? db.Contacts
        // The Abacus import: only what a person has released for it.
        : currentUser.IsIntegration ? db.Contacts.Where(c => c.AbacusStatus == AbacusStatus.ToImport)
        // Users: the contacts they captured themselves.
        : db.Contacts.Where(c => c.CreatedBy == currentUser.Name);
}
