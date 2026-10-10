using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Bandvcard.Api.Tests;

public class ProductionWithApiKeyFactory : ProductionFactory
{
    public const string ApiKey = "test-key-0123456789";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting(ApiKeyAuthHandler.ConfigurationKey, ApiKey);
    }
}

public class DevModeWithApiKeyFactory : DevModeFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting(ApiKeyAuthHandler.ConfigurationKey, ProductionWithApiKeyFactory.ApiKey);
    }
}

// The machine access for the Abacus import, against the real authentication setup.
public class ApiKeyTests
{
    private static HttpClient CreateClient(ApiFactory factory, string? apiKey = ProductionWithApiKeyFactory.ApiKey)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        if (apiKey is not null)
        {
            client.DefaultRequestHeaders.Add(ApiKeyAuthHandler.Header, apiKey);
        }

        return client;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    // Two contacts of different users are released, one is not; each has an opportunity.
    private static async Task<(Guid Released, Guid NotReleased)> SeedAsync(ApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BandvcardDbContext>();
        Contact Add(string lastName, AbacusStatus status, string photoLink)
        {
            var contact = new Contact { LastName = lastName, AbacusStatus = status, PhotoLink = photoLink };
            contact.Opportunities.Add(new Opportunity { Text = $"Chance {lastName}" });
            db.Contacts.Add(contact);
            return contact;
        }

        var released = Add("Frei", AbacusStatus.ToImport, "/api/photos/2026/10/11111111111111111111111111111111.jpg");
        Add("Auch-Frei", AbacusStatus.ToImport, "/api/photos/2026/10/22222222222222222222222222222222.jpg");
        var notReleased = Add("Gesperrt", AbacusStatus.None, "/api/photos/2026/10/33333333333333333333333333333333.jpg");
        await db.SaveChangesAsync();
        return (released.Id, notReleased.Id);
    }

    [Fact]
    public async Task TheKey_ReadsExactlyTheReleasedContactsWithTheirOpportunities()
    {
        await using var factory = new ProductionWithApiKeyFactory();
        var (released, notReleased) = await SeedAsync(factory);
        var client = CreateClient(factory);

        var contacts = await JsonAsync(await client.GetAsync("/api/Contacts?$expand=opportunities&$orderby=lastName"));
        var names = contacts.GetProperty("value").EnumerateArray().Select(c => c.GetProperty("lastName").GetString());
        Assert.Equal(["Auch-Frei", "Frei"], names);
        Assert.Equal("Chance Auch-Frei", contacts.GetProperty("value")[0].GetProperty("opportunities")[0].GetProperty("text").GetString());

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/Contacts({released})")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/Contacts({notReleased})")).StatusCode);

        var opportunities = await JsonAsync(await client.GetAsync("/api/Opportunities"));
        var texts = opportunities.GetProperty("value").EnumerateArray().Select(o => o.GetProperty("text").GetString()).Order();
        Assert.Equal(["Chance Auch-Frei", "Chance Frei"], texts);

        // Not even by asking for unreleased contacts explicitly.
        var forced = await JsonAsync(await client.GetAsync("/api/Contacts?$filter=abacusStatus eq 'None'"));
        Assert.Empty(forced.GetProperty("value").EnumerateArray());
    }

    [Fact]
    public async Task TheKey_CannotChangeAnything()
    {
        await using var factory = new ProductionWithApiKeyFactory();
        var (released, notReleased) = await SeedAsync(factory);
        var client = CreateClient(factory);
        var contact = $"/api/Contacts({released})";

        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/Contacts", new { lastName = "Neu" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PatchAsJsonAsync(contact, new { abacusStatus = "None" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PatchAsJsonAsync($"/api/Contacts({notReleased})", new { abacusStatus = "ToImport" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync(contact)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/Opportunities", new { contactId = released, text = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/api/photos", new MultipartFormDataContent())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/Users")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(contact)).StatusCode);
    }

    [Theory]
    [InlineData("wrong-key")]
    [InlineData("")]
    [InlineData(null)]
    public async Task WithoutTheRightKey_NothingIsReadable(string? apiKey)
    {
        await using var factory = new ProductionWithApiKeyFactory();
        await SeedAsync(factory);

        var response = await CreateClient(factory, apiKey).GetAsync("/api/Contacts");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WithoutAConfiguredKey_NoKeyWorks()
    {
        await using var factory = new ProductionFactory();

        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient(factory, "").GetAsync("/api/Contacts")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient(factory, "anything").GetAsync("/api/Contacts")).StatusCode);
    }

    [Fact]
    public async Task TheKey_IsItsOwnIdentityAndCreatesNoUser()
    {
        await using var factory = new ProductionWithApiKeyFactory();

        var me = await JsonAsync(await CreateClient(factory).GetAsync("/api/auth/me"));

        Assert.Equal(ApiKeyAuthHandler.IdentityName, me.GetProperty("email").GetString());
        Assert.Equal(Roles.Integration, me.GetProperty("role").GetString());
        using var scope = factory.Services.CreateScope();
        Assert.Empty(scope.ServiceProvider.GetRequiredService<BandvcardDbContext>().Users);
    }

    [Fact]
    public async Task InDevelopment_TheKeyBehavesTheSame_AndAWrongKeyIsNotTheDeveloper()
    {
        await using var factory = new DevModeWithApiKeyFactory();
        var (_, notReleased) = await SeedAsync(factory);

        // The developer (admin or not) is someone else than the integration.
        var withKey = CreateClient(factory);
        var me = await JsonAsync(await withKey.GetAsync("/api/auth/me"));
        Assert.Equal(Roles.Integration, me.GetProperty("role").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await withKey.GetAsync($"/api/Contacts({notReleased})")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await withKey.PostAsJsonAsync("/api/Contacts", new { lastName = "Neu" })).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateClient(factory, "wrong-key").GetAsync("/api/Contacts")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await CreateClient(factory, apiKey: null).GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task TheKey_ReadsPhotosOfReleasedContactsOnly()
    {
        await using var factory = new ProductionWithApiKeyFactory();
        await SeedAsync(factory);
        var storage = factory.Services.GetRequiredService<Storage.IPhotoStorage>();
        foreach (var name in new[] { "11111111111111111111111111111111", "33333333333333333333333333333333" })
        {
            await storage.SaveAsync($"2026/10/{name}.jpg", new MemoryStream([1, 2, 3]), 3, "image/jpeg", default);
        }

        var client = CreateClient(factory);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/photos/2026/10/11111111111111111111111111111111.jpg")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/photos/2026/10/33333333333333333333333333333333.jpg")).StatusCode);
    }
}
