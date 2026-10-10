using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Bandvcard.Api.Auth;
using Bandvcard.Api.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace Bandvcard.Api.Tests;

public class InMemoryPhotoStorage : IPhotoStorage
{
    private readonly ConcurrentDictionary<string, (byte[] Content, string ContentType)> _objects = new();

    public async Task SaveAsync(
        string key, Stream content, long size, string contentType, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        _objects[key] = (buffer.ToArray(), contentType);
    }

    public Task<string?> GetContentTypeAsync(string key, CancellationToken cancellationToken) =>
        Task.FromResult(_objects.TryGetValue(key, out var found) ? found.ContentType : null);

    public Task CopyToAsync(string key, Stream destination, CancellationToken cancellationToken) =>
        destination.WriteAsync(_objects[key].Content, cancellationToken).AsTask();

    // Lets a test simulate an unreachable storage.
    public bool FailDeletes { get; set; }

    public Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        if (FailDeletes)
        {
            throw new IOException("storage unavailable");
        }

        _objects.TryRemove(key, out _);
        return Task.CompletedTask;
    }
}

public class PhotoTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly byte[] Image = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];

    private HttpClient CreateClient(bool loggedIn = true, string user = "tester@example.com", string? role = null)
    {
        var client = factory.CreateClient();
        if (loggedIn)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.Header, user);
        }

        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        }

        return client;
    }

    private static MultipartFormDataContent Form(byte[] content, string contentType)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", "card" } };
    }

    [Fact]
    public async Task Photo_CanBeUploadedAndFetchedThroughItsLink()
    {
        var client = CreateClient();

        var upload = await client.PostAsync("/api/photos", Form(Image, "image/jpeg"));
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var link = JsonDocument.Parse(await upload.Content.ReadAsStringAsync())
            .RootElement.GetProperty("photoLink").GetString()!;
        Assert.Matches(@"^/api/photos/\d{4}/\d{2}/[0-9a-f]{32}\.jpg$", link);

        // A photo becomes readable through a contact of the user.
        await CreateContactAsync(client, link);
        var download = await client.GetAsync(link);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/jpeg", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Image, await download.Content.ReadAsByteArrayAsync());
    }

    private static async Task<string> UploadAsync(HttpClient client)
    {
        var upload = await client.PostAsync("/api/photos", Form(Image, "image/jpeg"));
        return JsonDocument.Parse(await upload.Content.ReadAsStringAsync())
            .RootElement.GetProperty("photoLink").GetString()!;
    }

    private static async Task<string> CreateContactAsync(HttpClient client, string? photoLink)
    {
        var create = await client.PostAsJsonAsync("/api/Contacts", new { lastName = "Foto", photoLink });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var id = JsonDocument.Parse(await create.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
        return $"/api/Contacts({id})";
    }

    [Fact]
    public async Task DeletingAContact_DeletesItsPhoto()
    {
        var client = CreateClient();
        var link = await UploadAsync(client);
        var contact = await CreateContactAsync(client, link);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(contact)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(link)).StatusCode);
    }

    [Fact]
    public async Task DeletingAContact_KeepsAPhotoThatAnotherContactStillUses()
    {
        var client = CreateClient();
        var link = await UploadAsync(client);
        var first = await CreateContactAsync(client, link);
        var second = await CreateContactAsync(client, link);

        await client.DeleteAsync(first);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(link)).StatusCode);

        await client.DeleteAsync(second);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(link)).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("https://example.com/card.jpg")]
    [InlineData("/api/photos/../../etc/passwd")]
    public async Task DeletingAContact_WithoutAStoredPhoto_JustDeletesTheContact(string? photoLink)
    {
        var client = CreateClient();
        var contact = await CreateContactAsync(client, photoLink);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(contact)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(contact)).StatusCode);
    }

    [Fact]
    public async Task DeletingAContact_StillSucceeds_WhenThePhotoCannotBeDeleted()
    {
        var client = CreateClient();
        var link = await UploadAsync(client);
        var contact = await CreateContactAsync(client, link);
        var storage = (InMemoryPhotoStorage)factory.Services.GetRequiredService<IPhotoStorage>();

        storage.FailDeletes = true;
        try
        {
            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(contact)).StatusCode);
        }
        finally
        {
            storage.FailDeletes = false;
        }

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(contact)).StatusCode);
        // The photo is still stored; without a contact only an admin can see that.
        var admin = CreateClient(user: "admin@example.com", role: Roles.Admin);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(link)).StatusCode);
    }

    [Fact]
    public async Task Photo_IsOnlyReadableByItsOwnerAndAdmins()
    {
        var owner = CreateClient();
        var other = CreateClient(user: "other@example.com");
        var admin = CreateClient(user: "admin@example.com", role: Roles.Admin);
        var link = await UploadAsync(owner);

        // Not attached to a contact yet: nobody but an admin can read it.
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync(link)).StatusCode);
        await CreateContactAsync(owner, link);

        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync(link)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(link)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync(link)).StatusCode);

        // Attaching the foreign photo to an own contact must not unlock it.
        var steal = await other.PostAsJsonAsync("/api/Contacts", new { lastName = "Dieb", photoLink = link });
        Assert.Equal(HttpStatusCode.BadRequest, steal.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(link)).StatusCode);
    }

    [Fact]
    public async Task Photo_OtherFileTypes_AreRejected()
    {
        var response = await CreateClient().PostAsync("/api/photos", Form(Image, "application/pdf"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/photos/2026/10/00000000000000000000000000000000.jpg")]
    [InlineData("/api/photos/..%2F..%2Fsecret")]
    [InlineData("/api/photos/anything")]
    public async Task Photo_UnknownOrMalformedKey_IsNotFound(string url)
    {
        var response = await CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Photos_RequireLogin()
    {
        var client = CreateClient(loggedIn: false);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/photos", Form(Image, "image/jpeg"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/photos/2026/10/x.jpg")).StatusCode);
    }
}
