using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bandvcard.Api.Tests;

public class AuditFieldsTests
{
    private sealed class FakeCurrentUser : ICurrentUser
    {
        public string Name { get; set; } = "alice@example.com";
    }

    private sealed class FakeTimeProvider : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 10, 12, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => Now;
    }

    private readonly FakeCurrentUser _user = new();
    private readonly FakeTimeProvider _time = new();
    private readonly DbContextOptions<BandvcardDbContext> _options =
        new DbContextOptionsBuilder<BandvcardDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

    private BandvcardDbContext CreateContext() => new(_options, _user, _time);

    [Fact]
    public async Task Create_SetsIdAndAllAuditFields()
    {
        await using var db = CreateContext();
        var contact = new Contact
        {
            LastName = "Muster",
            CreatedBy = "spoofed",
            CreatedAt = DateTimeOffset.MinValue,
        };

        db.Contacts.Add(contact);
        await db.SaveChangesAsync();

        Assert.NotEqual(Guid.Empty, contact.Id);
        Assert.Equal(_time.Now, contact.CreatedAt);
        Assert.Equal("alice@example.com", contact.CreatedBy);
        Assert.Equal(_time.Now, contact.UpdatedAt);
        Assert.Equal("alice@example.com", contact.UpdatedBy);
    }

    [Fact]
    public async Task Update_ChangesOnlyUpdatedFields()
    {
        var created = _time.Now;
        Guid id;
        await using (var db = CreateContext())
        {
            var contact = new Contact { LastName = "Muster" };
            db.Contacts.Add(contact);
            await db.SaveChangesAsync();
            id = contact.Id;
        }

        _user.Name = "bob@example.com";
        _time.Now = created.AddHours(1);
        await using (var db = CreateContext())
        {
            var contact = await db.Contacts.SingleAsync(c => c.Id == id);
            contact.LastName = "Beispiel";
            contact.CreatedBy = "spoofed";
            await db.SaveChangesAsync();
        }

        await using (var db = CreateContext())
        {
            var contact = await db.Contacts.SingleAsync(c => c.Id == id);
            Assert.Equal("Beispiel", contact.LastName);
            Assert.Equal(created, contact.CreatedAt);
            Assert.Equal("alice@example.com", contact.CreatedBy);
            Assert.Equal(created.AddHours(1), contact.UpdatedAt);
            Assert.Equal("bob@example.com", contact.UpdatedBy);
        }
    }
}
