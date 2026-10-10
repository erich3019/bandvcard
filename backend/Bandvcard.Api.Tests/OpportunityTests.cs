using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bandvcard.Api.Auth;
using Bandvcard.Api.Entities;

namespace Bandvcard.Api.Tests;

public class OpportunityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient Client(string user = "opp-alice@example.com", string role = Roles.User)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, user);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        return client;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<Guid> CreateContactAsync(HttpClient client, string lastName = "Opp")
    {
        var create = await client.PostAsJsonAsync("/api/Contacts", new { lastName });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        return (await JsonAsync(create)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateOpportunityAsync(HttpClient client, Guid contactId, string text)
    {
        var create = await client.PostAsJsonAsync("/api/Opportunities", new { contactId, text });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        return (await JsonAsync(create)).GetProperty("id").GetGuid();
    }

    private static async Task<List<string?>> TextsAsync(HttpClient client, Guid contactId)
    {
        var contact = await JsonAsync(await client.GetAsync(
            $"/api/Contacts({contactId})?$expand=opportunities($orderby=text)"));
        return contact.GetProperty("opportunities").EnumerateArray()
            .Select(o => o.GetProperty("text").GetString()).ToList();
    }

    [Fact]
    public async Task AContact_CanHaveSeveralOpportunities()
    {
        var client = Client();
        var contactId = await CreateContactAsync(client);

        await CreateOpportunityAsync(client, contactId, "  Wartungsvertrag 2027  ");
        await CreateOpportunityAsync(client, contactId, "Neue Fräsmaschine");
        var third = await CreateOpportunityAsync(client, contactId, "Schulung");

        Assert.Equal(["Neue Fräsmaschine", "Schulung", "Wartungsvertrag 2027"], await TextsAsync(client, contactId));

        Assert.Equal(HttpStatusCode.NoContent, (await client.PatchAsJsonAsync($"/api/Opportunities({third})", new { text = "Schulung vor Ort" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/Opportunities({third})")).StatusCode);
        Assert.Equal(["Neue Fräsmaschine", "Wartungsvertrag 2027"], await TextsAsync(client, contactId));

        var stored = await JsonAsync(await client.GetAsync($"/api/Opportunities?$filter=contactId eq {contactId}&$top=1"));
        Assert.Equal("opp-alice@example.com", stored.GetProperty("value")[0].GetProperty("createdBy").GetString());
    }

    [Fact]
    public async Task OpportunityText_IsLimitedTo200Characters()
    {
        var client = Client();
        var contactId = await CreateContactAsync(client);

        var exact = await client.PostAsJsonAsync("/api/Opportunities", new { contactId, text = new string('x', 200) });
        var tooLong = await client.PostAsJsonAsync("/api/Opportunities", new { contactId, text = new string('x', 201) });
        var empty = await client.PostAsJsonAsync("/api/Opportunities", new { contactId, text = "   " });
        var missing = await client.PostAsJsonAsync("/api/Opportunities", new { contactId });

        Assert.Equal(HttpStatusCode.Created, exact.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        var id = (await JsonAsync(exact)).GetProperty("id").GetGuid();
        var patchTooLong = await client.PatchAsJsonAsync($"/api/Opportunities({id})", new { text = new string('y', 201) });
        Assert.Equal(HttpStatusCode.BadRequest, patchTooLong.StatusCode);
    }

    [Fact]
    public async Task Opportunities_FollowTheVisibilityOfTheirContact()
    {
        var alice = Client();
        var bob = Client("opp-bob@example.com");
        var admin = Client("opp-admin@example.com", Roles.Admin);
        var contactId = await CreateContactAsync(alice, "Geheim");
        var id = await CreateOpportunityAsync(alice, contactId, "Vertraulich");
        var url = $"/api/Opportunities({id})";

        // Bob can neither see nor change it, nor attach anything to Alice's contact.
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PatchAsJsonAsync(url, new { text = "Hack" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await bob.PostAsJsonAsync("/api/Opportunities", new { contactId, text = "Fremd" })).StatusCode);
        var bobsList = await JsonAsync(await bob.GetAsync($"/api/Opportunities?$filter=contactId eq {contactId}"));
        Assert.Empty(bobsList.GetProperty("value").EnumerateArray());

        Assert.Equal(["Vertraulich"], await TextsAsync(alice, contactId));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task AnOpportunity_CannotBeMovedToAnotherContact()
    {
        var client = Client();
        var first = await CreateContactAsync(client, "Erster");
        var second = await CreateContactAsync(client, "Zweiter");
        var id = await CreateOpportunityAsync(client, first, "Bleibt");

        var move = await client.PatchAsJsonAsync($"/api/Opportunities({id})", new { contactId = second });

        Assert.Equal(HttpStatusCode.BadRequest, move.StatusCode);
        Assert.Equal(["Bleibt"], await TextsAsync(client, first));
    }

    [Fact]
    public async Task AContact_CanBeReleasedForAbacusAndTakenBack()
    {
        var client = Client();
        var contactId = await CreateContactAsync(client, "Abacus");
        var url = $"/api/Contacts({contactId})";
        async Task<string?> StatusAsync() => (await JsonAsync(await client.GetAsync(url))).GetProperty("abacusStatus").GetString();

        Assert.Equal(nameof(AbacusStatus.None), await StatusAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await client.PatchAsJsonAsync(url, new { abacusStatus = "ToImport" })).StatusCode);
        Assert.Equal(nameof(AbacusStatus.ToImport), await StatusAsync());

        // This is the query an import can use to fetch the released contacts.
        var released = await JsonAsync(await client.GetAsync(
            "/api/Contacts?$filter=abacusStatus eq 'ToImport' and lastName eq 'Abacus'&$expand=opportunities"));
        Assert.Equal(contactId, released.GetProperty("value")[0].GetProperty("id").GetGuid());

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PatchAsJsonAsync(url, new { abacusStatus = "Whatever" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PatchAsJsonAsync(url, new { abacusStatus = "None" })).StatusCode);
        Assert.Equal(nameof(AbacusStatus.None), await StatusAsync());
    }

    [Fact]
    public async Task AForeignContact_CannotBeReleasedForAbacus()
    {
        var contactId = await CreateContactAsync(Client(), "Nicht-Bobs");

        var release = await Client("opp-bob@example.com").PatchAsJsonAsync(
            $"/api/Contacts({contactId})", new { abacusStatus = "ToImport" });

        Assert.Equal(HttpStatusCode.NotFound, release.StatusCode);
    }
}
