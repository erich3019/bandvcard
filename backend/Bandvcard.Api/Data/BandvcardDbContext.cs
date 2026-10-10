using Bandvcard.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bandvcard.Api.Data;

public class BandvcardDbContext(
    DbContextOptions<BandvcardDbContext> options,
    ICurrentUser currentUser,
    TimeProvider timeProvider) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<PostalCodeEntry> PostalCodes => Set<PostalCodeEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(user =>
        {
            user.HasKey(u => u.Email);
            user.Property(u => u.Email).HasMaxLength(320);
            user.Property(u => u.Status).HasConversion<string>().HasMaxLength(16);
            user.Property(u => u.Role).HasConversion<string>().HasMaxLength(16);
        });

        modelBuilder.Entity<PostalCodeEntry>(entry =>
        {
            entry.HasKey(e => e.PostalCode);
            entry.Property(e => e.PostalCode).HasMaxLength(16);
        });

        modelBuilder.Entity<Contact>(contact =>
        {
            contact.Property(c => c.Id).ValueGeneratedOnAdd();
            contact.HasOne(c => c.PostalCodeEntry)
                .WithMany(e => e.Contacts)
                .HasForeignKey(c => c.PostalCode)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ApplyAuditFields();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void ApplyAuditFields()
    {
        var now = timeProvider.GetUtcNow();
        var user = currentUser.Name;

        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.CreatedBy = user;
            }
            else if (entry.State == EntityState.Modified)
            {
                // Keep the original creation values even if a caller changed them.
                entry.Property(e => e.CreatedAt).IsModified = false;
                entry.Property(e => e.CreatedBy).IsModified = false;
            }
            else
            {
                continue;
            }

            entry.Entity.UpdatedAt = now;
            entry.Entity.UpdatedBy = user;
        }
    }
}
