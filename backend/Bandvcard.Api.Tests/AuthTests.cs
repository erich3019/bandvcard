using System.Net;
using System.Text.Json;
using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Bandvcard.Api.Tests;

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

    [Fact]
    public async Task Login_WithoutEntraConfiguration_Returns503()
    {
        var response = await CreateClient().GetAsync("/api/auth/login");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task PasswordLogin_DoesNotExist_WithoutTestLogins()
    {
        var client = CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string> { ["email"] = "a@b.c", ["password"] = "x" });

        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/api/auth/login", form)).StatusCode);
        Assert.Contains("\"mode\":\"none\"", await client.GetStringAsync("/api/auth/mode"));
    }

    [Fact]
    public async Task Logout_IsAllowedAnonymouslyAndRedirectsToLoginPage()
    {
        var response = await CreateClient().PostAsync("/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/login", response.Headers.Location?.OriginalString);
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
    public async Task LaterLogin_KeepsExistingUserUnchanged()
    {
        _db.Users.Add(new User { Email = "erika@example.com", FirstName = "Erika", LastName = "Muster", Phone = "123" });
        await _db.SaveChangesAsync();

        var user = await CreateService().SignInAsync("ERIKA@example.com", "Other", "Name");

        Assert.NotNull(user);
        var stored = await _db.Users.SingleAsync();
        Assert.Equal("Erika", stored.FirstName);
        Assert.Equal("123", stored.Phone);
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

public class TestLoginFactory : ApiFactory
{
    public const string Email = "dev@example.com";
    public const string Password = "correct horse";

    protected override bool UseTestAuth => false;

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting(TestLogins.Key, $"Dev@Example.com:{Password}, second@example.com:other");
    }
}

public class TestLoginInProductionFactory : TestLoginFactory
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("environment", "Production");
    }
}

public class TestLoginTests
{
    private static HttpClient CreateClient(TestLoginFactory factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private static Task<HttpResponseMessage> LoginAsync(
        HttpClient client, string email, string password, string? returnUrl = null)
    {
        var form = new Dictionary<string, string> { ["email"] = email, ["password"] = password };
        if (returnUrl is not null)
        {
            form["returnUrl"] = returnUrl;
        }

        return client.PostAsync("/api/auth/login", new FormUrlEncodedContent(form));
    }

    private static async Task ChangeUserAsync(TestLoginFactory factory, Action<User> change)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BandvcardDbContext>();
        change(await db.Users.SingleAsync(u => u.Email == TestLoginFactory.Email));
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Login_SignsInCreatesUserAndStopsWorkingWhenUserIsDeactivated()
    {
        await using var factory = new TestLoginFactory();
        var client = CreateClient(factory);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);

        var login = await LoginAsync(client, " DEV@example.com", TestLoginFactory.Password, "/somewhere");
        Assert.Equal(HttpStatusCode.Redirect, login.StatusCode);
        Assert.Equal("/somewhere", login.Headers.Location?.OriginalString);

        var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Contains(TestLoginFactory.Email, await me.Content.ReadAsStringAsync());

        // A role change applies to the running session, without a new login.
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/Users")).StatusCode);
        await ChangeUserAsync(factory, user => user.Role = UserRole.Admin);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Users")).StatusCode);
        Assert.Contains("\"role\":\"Admin\"", await (await client.GetAsync("/api/auth/me")).Content.ReadAsStringAsync());

        await ChangeUserAsync(factory, user => user.Status = UserStatus.Inactive);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        var again = await LoginAsync(client, TestLoginFactory.Email, TestLoginFactory.Password);
        Assert.Equal("/login?error=inactive", again.Headers.Location?.OriginalString);
    }

    [Theory]
    [InlineData(TestLoginFactory.Email, "wrong")]
    [InlineData(TestLoginFactory.Email, "")]
    [InlineData(TestLoginFactory.Email, "other")] // the password of the second account
    [InlineData("unknown@example.com", TestLoginFactory.Password)]
    [InlineData("", "")]
    public async Task Login_WithWrongCredentials_IsRefused(string email, string password)
    {
        await using var factory = new TestLoginFactory();
        var client = CreateClient(factory);

        var login = await LoginAsync(client, email, password);

        Assert.Equal("/login?error=credentials", login.Headers.Location?.OriginalString);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Login_DoesNotRedirectToForeignSites()
    {
        await using var factory = new TestLoginFactory();

        var login = await LoginAsync(
            CreateClient(factory), TestLoginFactory.Email, TestLoginFactory.Password, "https://evil.example/");

        Assert.Equal("/", login.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Login_IsRateLimited()
    {
        await using var factory = new TestLoginFactory();
        var client = CreateClient(factory);

        var statuses = new List<HttpStatusCode>();
        for (var attempt = 0; attempt < 12; attempt++)
        {
            statuses.Add((await LoginAsync(client, TestLoginFactory.Email, "guess" + attempt)).StatusCode);
        }

        Assert.All(statuses.Take(10), status => Assert.Equal(HttpStatusCode.Redirect, status));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
    }

    [Fact]
    public async Task Mode_TellsTheLoginPageToAskForAPassword()
    {
        await using var factory = new TestLoginFactory();
        var client = CreateClient(factory);

        Assert.Contains("\"mode\":\"password\"", await client.GetStringAsync("/api/auth/mode"));
        // The Microsoft entry point leads back to the form instead of signing anyone in.
        var microsoft = await client.GetAsync("/api/auth/login");
        Assert.Equal("/login", microsoft.Headers.Location?.OriginalString);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task TestLogins_OutsideDevelopment_PreventStartup()
    {
        await using var factory = new TestLoginInProductionFactory();

        var error = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("TEST_LOGINS", error.Message);
    }
}
