using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Bandvcard.Api.Tests;

// Uses the header-based test scheme of ApiFactory: who is allowed in once there is a login.
public class AuthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient CreateClient(string? user = null)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        if (user is not null)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.Header, user);
        }

        return client;
    }

    [Theory]
    [InlineData("/api/Contacts")]
    [InlineData("/api/Users")]
    [InlineData("/api/PostalCodes")]
    [InlineData("/api/$metadata")]
    [InlineData("/api/auth/me")]
    public async Task Endpoints_RequireLogin(string url)
    {
        var response = await CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_ReturnsTheLoggedInUser()
    {
        var response = await CreateClient("erika@example.com").GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("erika@example.com", me.GetProperty("email").GetString());
    }
}

public class UserSignInServiceTests
{
    private sealed class NoUser : ICurrentUser
    {
        public string Name => "test";

        public bool IsAdmin => false;
    }

    private readonly BandvcardDbContext _db = new(
        new DbContextOptionsBuilder<BandvcardDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
        new NoUser(),
        TimeProvider.System);

    private UserSignInService CreateService(string adminEmails = "") => new(
        _db,
        new AdminEmails(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [AdminEmails.Key] = adminEmails })
            .Build()));

    [Fact]
    public async Task FirstLogin_CreatesActiveUserWithNormalisedEmail()
    {
        var user = await CreateService().SignInAsync(" Erika.Muster@Example.com ", "Erika", "Muster");

        Assert.NotNull(user);
        var stored = await _db.Users.SingleAsync();
        Assert.Equal("erika.muster@example.com", stored.Email);
        Assert.Equal("Erika", stored.FirstName);
        Assert.Equal("Muster", stored.LastName);
        Assert.Equal(UserStatus.Active, stored.Status);
        Assert.Equal(UserRole.User, stored.Role);
    }

    [Fact]
    public async Task ConfiguredAdmin_BecomesAdminOnFirstAndOnLaterLogins()
    {
        var service = CreateService(adminEmails: "Boss@Example.com, other@example.com");

        var created = await service.SignInAsync("boss@example.com", "B", "Oss");
        Assert.Equal(UserRole.Admin, created!.Role);

        // Demoted behind the app's back: the next login restores the role.
        created.Role = UserRole.User;
        await _db.SaveChangesAsync();
        await service.SignInAsync("boss@example.com", "B", "Oss");
        Assert.Equal(UserRole.Admin, (await _db.Users.SingleAsync()).Role);
    }

    [Fact]
    public async Task LaterLogin_RefreshesTheNameAndKeepsEverythingElse()
    {
        _db.Users.Add(new User
        {
            Email = "erika@example.com",
            FirstName = "Erika",
            LastName = "Muster",
            Phone = "123",
            Role = UserRole.Admin,
        });
        await _db.SaveChangesAsync();

        var user = await CreateService().SignInAsync("ERIKA@example.com", "Erika", "Beispiel");

        Assert.NotNull(user);
        var stored = await _db.Users.SingleAsync();
        Assert.Equal("Beispiel", stored.LastName);
        Assert.Equal("123", stored.Phone);
        Assert.Equal(UserRole.Admin, stored.Role);

        // A login that reports no name leaves the stored one alone.
        await CreateService().SignInAsync("erika@example.com", null, null);
        Assert.Equal("Erika", (await _db.Users.SingleAsync()).FirstName);
    }

    [Fact]
    public async Task InactiveUser_IsRejected()
    {
        _db.Users.Add(new User
        {
            Email = "gone@example.com",
            FirstName = "G",
            LastName = "One",
            Status = UserStatus.Inactive,
        });
        await _db.SaveChangesAsync();
        var service = CreateService();

        Assert.Null(await service.SignInAsync("gone@example.com", "G", "One"));
        Assert.Null(await service.FindActiveAsync("gone@example.com"));
    }
}

// The real authentication of the Development environment: no login.
public class DevModeFactory : ApiFactory
{
    protected override bool UseTestAuth => false;

    protected virtual string DevUser => "Developer@Example.com";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting(DevAuthHandler.EmailKey, DevUser);
    }
}

public class DevModeAdminFactory : DevModeFactory
{
    protected override string DevUser => ConfiguredAdmin;
}

// The real authentication of every other environment: Microsoft login and session cookie.
public class ProductionFactory : ApiFactory
{
    protected override bool UseTestAuth => false;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("environment", "Production");
        // Must not matter outside Development.
        builder.UseSetting(DevAuthHandler.EmailKey, "developer@example.com");
    }
}

public class ProductionWithEntraFactory : ProductionFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Entra:TenantId", "00000000-0000-0000-0000-000000000001");
        builder.UseSetting("Entra:ClientId", "00000000-0000-0000-0000-000000000002");
        builder.UseSetting("Entra:ClientSecret", "not-a-real-secret");
    }
}

public class EnvironmentAuthTests
{
    private const string DevEmail = "developer@example.com";

    private static HttpClient CreateClient(ApiFactory factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Development_NeedsNoLogin_AndStoresTheDeveloperAsUser()
    {
        await using var factory = new DevModeFactory();
        var client = CreateClient(factory);

        var me = await JsonAsync(await client.GetAsync("/api/auth/me"));
        Assert.Equal(DevEmail, me.GetProperty("email").GetString());
        Assert.Equal("User", me.GetProperty("role").GetString());
        Assert.False(me.GetProperty("loginRequired").GetBoolean());
        Assert.Contains("\"mode\":\"development\"", await client.GetStringAsync("/api/auth/mode"));

        var contact = await JsonAsync(await client.PostAsJsonAsync("/api/Contacts", new { lastName = "Dev" }));
        Assert.Equal(DevEmail, contact.GetProperty("createdBy").GetString());

        using var scope = factory.Services.CreateScope();
        var users = await scope.ServiceProvider.GetRequiredService<BandvcardDbContext>().Users.ToListAsync();
        Assert.Equal([DevEmail], users.Select(u => u.Email));
    }

    [Fact]
    public async Task Development_LoginAndLogoutJustLeadIntoTheApp()
    {
        await using var factory = new DevModeFactory();
        var client = CreateClient(factory);

        Assert.Equal("/kontakte", (await client.GetAsync("/api/auth/login?returnUrl=/kontakte")).Headers.Location?.OriginalString);
        Assert.Equal("/", (await client.GetAsync("/api/auth/login?returnUrl=https://evil.example/")).Headers.Location?.OriginalString);
        Assert.Equal("/", (await client.PostAsync("/api/auth/logout", null)).Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Development_TheDeveloperIsAdminOnlyIfConfiguredAsAdmin()
    {
        await using var user = new DevModeFactory();
        Assert.Equal(HttpStatusCode.Forbidden, (await CreateClient(user).GetAsync("/api/Users")).StatusCode);

        await using var admin = new DevModeAdminFactory();
        var client = CreateClient(admin);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Users")).StatusCode);
        Assert.Equal("Admin", (await JsonAsync(await client.GetAsync("/api/auth/me"))).GetProperty("role").GetString());
    }

    [Fact]
    public async Task Development_AnInactiveDeveloperIsLockedOut()
    {
        await using var factory = new DevModeFactory();
        var client = CreateClient(factory);
        await client.GetAsync("/api/auth/me");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BandvcardDbContext>();
            (await db.Users.SingleAsync()).Status = UserStatus.Inactive;
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData("/api/auth/me")]
    [InlineData("/api/Contacts")]
    [InlineData("/api/photos/2026/10/00000000000000000000000000000000.jpg")]
    public async Task Production_RequiresALogin(string url)
    {
        await using var factory = new ProductionFactory();

        var response = await CreateClient(factory).GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Production_WithoutEntraConfiguration_HasNoLogin()
    {
        await using var factory = new ProductionFactory();
        var client = CreateClient(factory);

        Assert.Contains("\"mode\":\"none\"", await client.GetStringAsync("/api/auth/mode"));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/api/auth/login")).StatusCode);
    }

    [Fact]
    public async Task Production_WithEntraConfiguration_OffersTheMicrosoftLogin()
    {
        await using var factory = new ProductionWithEntraFactory();
        var client = CreateClient(factory);

        Assert.Contains("\"mode\":\"microsoft\"", await client.GetStringAsync("/api/auth/mode"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Production_LogoutLeadsToTheLoginPage()
    {
        await using var factory = new ProductionFactory();

        var response = await CreateClient(factory).PostAsync("/api/auth/logout", null);

        Assert.Equal("/login", response.Headers.Location?.OriginalString);
    }
}
