using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Bandvcard.Api.Tests;

public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = Guid.NewGuid().ToString();

    public const string ConfiguredAdmin = "configured-admin@example.com";

    // False keeps the real cookie authentication instead of the header-based test scheme.
    protected virtual bool UseTestAuth => true;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Keep the tests independent of a developer's .env file.
        builder.UseSetting(TestLogins.Key, "");
        builder.UseSetting(AdminEmails.Key, ConfiguredAdmin);
        // Keep the tests independent of Entra values in a developer's .env file.
        builder.UseSetting("Entra:TenantId", "");
        builder.UseSetting("Entra:ClientId", "");
        builder.UseSetting("Entra:ClientSecret", "");
        builder.ConfigureServices(services =>
        {
            // Swap PostgreSQL for the in-memory provider.
            services.RemoveAll<DbContextOptions<BandvcardDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<BandvcardDbContext>>();
            services.AddDbContext<BandvcardDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));

            services.RemoveAll<IPhotoStorage>();
            services.AddSingleton<IPhotoStorage, InMemoryPhotoStorage>();

            if (!UseTestAuth)
            {
                return;
            }

            // Replace the Microsoft login with a header-based test scheme.
            services.AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null);
            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });
        });
    }
}

// Authenticates a request as the user named in the X-Test-User header,
// with the role from X-Test-Role (a normal user if absent).
public class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";
    public const string Header = "X-Test-User";
    public const string RoleHeader = "X-Test-Role";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(Header, out var user))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.Name, user.ToString()),
                new Claim(ClaimTypes.GivenName, "Test"),
                new Claim(ClaimTypes.Role, Request.Headers.TryGetValue(RoleHeader, out var role) ? role.ToString() : Roles.User),
            ],
            SchemeName);
        return Task.FromResult(AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

public class ODataApiTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public const string TestUser = "tester@example.com";

    private readonly HttpClient _admin;

    public ODataApiTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add(TestAuthHandler.Header, TestUser);
        _admin = factory.CreateClient();
        _admin.DefaultRequestHeaders.Add(TestAuthHandler.Header, "admin@example.com");
        _admin.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, Roles.Admin);
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Metadata_ListsAllEntitySets()
    {
        var metadata = await _client.GetStringAsync("/api/$metadata");

        Assert.Contains("EntitySet Name=\"Contacts\"", metadata);
        Assert.Contains("EntitySet Name=\"Users\"", metadata);
        Assert.Contains("EntitySet Name=\"PostalCodes\"", metadata);
    }

    [Fact]
    public async Task Contact_CanBeCreatedReadPatchedAndDeleted()
    {
        var clientId = Guid.NewGuid();
        var create = await _client.PostAsJsonAsync("/api/Contacts", new
        {
            id = clientId,
            firstName = "Erika",
            lastName = "Muster",
            createdBy = "spoofed",
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await ReadJsonAsync(create);
        var id = created.GetProperty("id").GetGuid();
        Assert.NotEqual(clientId, id);
        Assert.Equal(TestUser, created.GetProperty("createdBy").GetString());

        var patch = await _client.PatchAsJsonAsync($"/api/Contacts({id})", new { lastName = "Beispiel" });
        Assert.Equal(HttpStatusCode.NoContent, patch.StatusCode);

        var read = await ReadJsonAsync(await _client.GetAsync($"/api/Contacts({id})"));
        Assert.Equal("Erika", read.GetProperty("firstName").GetString());
        Assert.Equal("Beispiel", read.GetProperty("lastName").GetString());

        var delete = await _client.DeleteAsync($"/api/Contacts({id})");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/Contacts({id})")).StatusCode);
    }

    [Fact]
    public async Task Contacts_SupportFilterAndCount()
    {
        await _client.PostAsJsonAsync("/api/Contacts", new { lastName = "Filter-A", companyName = "Acme" });
        await _client.PostAsJsonAsync("/api/Contacts", new { lastName = "Filter-B", companyName = "Other" });

        var result = await ReadJsonAsync(await _client.GetAsync(
            "/api/Contacts?$filter=companyName eq 'Acme' and startswith(lastName,'Filter')&$count=true"));

        Assert.Equal(1, result.GetProperty("@odata.count").GetInt32());
        Assert.Equal("Filter-A", result.GetProperty("value")[0].GetProperty("lastName").GetString());
    }

    [Fact]
    public async Task Contact_WithUnknownPostalCodeAndNoCity_IsRejected()
    {
        var response = await _client.PostAsJsonAsync("/api/Contacts", new { lastName = "X", postalCode = "00000" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Contact_WithUnknownPostalCodeAndCity_AddsItToTheDirectory()
    {
        var create = await _client.PostAsJsonAsync(
            "/api/Contacts", new { lastName = "Neu", postalCode = "3011", city = " Bern " });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var entry = await ReadJsonAsync(await _client.GetAsync("/api/PostalCodes('3011')"));
        Assert.Equal("Bern", entry.GetProperty("placeName").GetString());

        // A second contact with the same postal code reuses the entry and does not rename it.
        var second = await _client.PostAsJsonAsync(
            "/api/Contacts", new { lastName = "Zwei", postalCode = "3011", city = "Berne" });
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        entry = await ReadJsonAsync(await _client.GetAsync("/api/PostalCodes('3011')"));
        Assert.Equal("Bern", entry.GetProperty("placeName").GetString());
    }

    [Fact]
    public async Task PostalCode_InUse_CannotBeDeleted_AndExpandsOnContact()
    {
        var entry = await _admin.PostAsJsonAsync("/api/PostalCodes", new { postalCode = "8000", placeName = "Zürich" });
        Assert.Equal(HttpStatusCode.Created, entry.StatusCode);
        var create = await _client.PostAsJsonAsync("/api/Contacts", new { lastName = "Zh", postalCode = "8000" });
        var id = (await ReadJsonAsync(create)).GetProperty("id").GetGuid();

        var expanded = await ReadJsonAsync(await _client.GetAsync($"/api/Contacts({id})?$expand=postalCodeEntry"));
        Assert.Equal("Zürich", expanded.GetProperty("postalCodeEntry").GetProperty("placeName").GetString());

        var delete = await _admin.DeleteAsync("/api/PostalCodes('8000')");
        Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
    }

    [Fact]
    public async Task User_EmailIsUniqueKeyAndCannotBeChanged()
    {
        var user = new { email = "erika@example.com", firstName = "Erika", lastName = "Muster", status = "Active" };
        Assert.Equal(HttpStatusCode.Created, (await _admin.PostAsJsonAsync("/api/Users", user)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _admin.PostAsJsonAsync("/api/Users", user)).StatusCode);

        var deactivate = await _admin.PatchAsJsonAsync("/api/Users('erika@example.com')", new { status = "Inactive" });
        Assert.Equal(HttpStatusCode.NoContent, deactivate.StatusCode);
        var read = await ReadJsonAsync(await _admin.GetAsync("/api/Users('erika@example.com')"));
        Assert.Equal("Inactive", read.GetProperty("status").GetString());

        var rename = await _admin.PatchAsJsonAsync("/api/Users('erika@example.com')", new { email = "other@example.com" });
        Assert.Equal(HttpStatusCode.BadRequest, rename.StatusCode);
    }

    [Fact]
    public async Task User_WithoutRequiredFields_IsRejected()
    {
        var response = await _admin.PostAsJsonAsync("/api/Users", new { email = "incomplete@example.com" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
