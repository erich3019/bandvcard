using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bandvcard.Api.Auth;

namespace Bandvcard.Api.Tests;

public class RolesTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient Client(string user, string role = Roles.User)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, user);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        return client;
    }

    private HttpClient Admin(string user = "roles-admin@example.com") => Client(user, Roles.Admin);

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> CreateContactAsync(HttpClient client, string lastName)
    {
        var create = await client.PostAsJsonAsync("/api/Contacts", new { lastName });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        return $"/api/Contacts({(await JsonAsync(create)).GetProperty("id").GetGuid()})";
    }

    private static async Task<List<string?>> LastNamesAsync(HttpClient client, string filter)
    {
        var list = await JsonAsync(await client.GetAsync($"/api/Contacts?$filter={filter}&$count=true"));
        var names = list.GetProperty("value").EnumerateArray().Select(c => c.GetProperty("lastName").GetString()).ToList();
        Assert.Equal(names.Count, list.GetProperty("@odata.count").GetInt32());
        return names;
    }

    [Fact]
    public async Task Users_SeeOnlyTheirOwnContacts_AdminsSeeAll()
    {
        var alice = Client("alice@example.com");
        var bob = Client("bob@example.com");
        await CreateContactAsync(alice, "Vis-Alice");
        await CreateContactAsync(bob, "Vis-Bob");
        const string filter = "startswith(lastName,'Vis-')";

        Assert.Equal(["Vis-Alice"], await LastNamesAsync(alice, filter));
        Assert.Equal(["Vis-Bob"], await LastNamesAsync(bob, filter));
        Assert.Equal(["Vis-Alice", "Vis-Bob"], (await LastNamesAsync(Admin(), filter)).Order());

        // Not even by asking for the other user's contacts explicitly.
        Assert.Empty(await LastNamesAsync(bob, "createdBy eq 'alice@example.com'"));
    }

    [Fact]
    public async Task AForeignContact_LooksLikeAMissingOne()
    {
        var alice = Client("alice@example.com");
        var bob = Client("bob@example.com");
        var contact = await CreateContactAsync(alice, "Privat");

        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync(contact)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PatchAsJsonAsync(contact, new { lastName = "Hack" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync(contact)).StatusCode);

        var unchanged = await JsonAsync(await alice.GetAsync(contact));
        Assert.Equal("Privat", unchanged.GetProperty("lastName").GetString());
    }

    [Fact]
    public async Task Admins_CanEditAndDeleteAnyContact()
    {
        var contact = await CreateContactAsync(Client("alice@example.com"), "Von-Alice");
        var admin = Admin();

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PatchAsJsonAsync(contact, new { lastName = "Vom-Admin" })).StatusCode);
        var edited = await JsonAsync(await admin.GetAsync(contact));
        // Still Alice's contact: the creator does not change when someone else edits it.
        Assert.Equal("alice@example.com", edited.GetProperty("createdBy").GetString());
        Assert.Equal("roles-admin@example.com", edited.GetProperty("updatedBy").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync(contact)).StatusCode);
    }

    [Fact]
    public async Task PostalCodes_CannotBeUsedToReadForeignContacts()
    {
        var alice = Client("alice@example.com");
        await alice.PostAsJsonAsync("/api/Contacts", new { lastName = "Leak", postalCode = "9000", city = "St. Gallen" });

        var response = await Client("bob@example.com").GetAsync("/api/PostalCodes?$expand=contacts");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostalCodes_AreReadableByAll_ButOnlyAdminsChangeThem()
    {
        var user = Client("alice@example.com");
        var admin = Admin();
        var entry = new { postalCode = "4000", placeName = "Basel" };

        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsJsonAsync("/api/PostalCodes", entry)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/PostalCodes", entry)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/PostalCodes('4000')")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PatchAsJsonAsync("/api/PostalCodes('4000')", new { placeName = "X" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.DeleteAsync("/api/PostalCodes('4000')")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync("/api/PostalCodes('4000')")).StatusCode);
    }

    [Fact]
    public async Task UserManagement_IsForAdminsOnly()
    {
        var user = Client("alice@example.com");
        var newUser = new { email = "new@example.com", firstName = "N", lastName = "Eu" };

        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/Users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/Users('alice@example.com')")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsJsonAsync("/api/Users", newUser)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PatchAsJsonAsync("/api/Users('alice@example.com')", new { role = "Admin" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.DeleteAsync("/api/Users('alice@example.com')")).StatusCode);
    }

    [Fact]
    public async Task Admins_CanChangeRoleAndStatusOfOthers()
    {
        var admin = Admin();
        await admin.PostAsJsonAsync("/api/Users", new { email = "promote@example.com", firstName = "P", lastName = "Romote" });

        var created = await JsonAsync(await admin.GetAsync("/api/Users('promote@example.com')"));
        Assert.Equal("User", created.GetProperty("role").GetString());

        var patch = await admin.PatchAsJsonAsync("/api/Users('promote@example.com')", new { role = "Admin", status = "Inactive" });
        Assert.Equal(HttpStatusCode.NoContent, patch.StatusCode);
        var changed = await JsonAsync(await admin.GetAsync("/api/Users('promote@example.com')"));
        Assert.Equal("Admin", changed.GetProperty("role").GetString());
        Assert.Equal("Inactive", changed.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Admins_CannotLockThemselvesOut()
    {
        const string self = "self-admin@example.com";
        var admin = Admin(self);
        await admin.PostAsJsonAsync("/api/Users", new { email = self, firstName = "S", lastName = "Elf", role = "Admin" });
        var url = $"/api/Users('{self}')";

        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync(url, new { role = "User" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PatchAsJsonAsync(url, new { status = "Inactive" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync(url)).StatusCode);

        // Other changes to the own user stay possible.
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PatchAsJsonAsync(url, new { phone = "123" })).StatusCode);
        var unchanged = await JsonAsync(await admin.GetAsync(url));
        Assert.Equal("Admin", unchanged.GetProperty("role").GetString());
        Assert.Equal("Active", unchanged.GetProperty("status").GetString());
    }

    [Fact]
    public async Task AConfiguredAdmin_CannotBeDemoted()
    {
        var admin = Admin();
        await admin.PostAsJsonAsync("/api/Users", new { email = ApiFactory.ConfiguredAdmin, firstName = "C", lastName = "Onf", role = "Admin" });

        var demote = await admin.PatchAsJsonAsync($"/api/Users('{ApiFactory.ConfiguredAdmin}')", new { role = "User" });

        Assert.Equal(HttpStatusCode.Conflict, demote.StatusCode);
    }
}
