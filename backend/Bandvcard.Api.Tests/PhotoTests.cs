using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Bandvcard.Api.Storage;

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
}

public class PhotoTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly byte[] Image = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];

    private HttpClient CreateClient(bool loggedIn = true)
    {
        var client = factory.CreateClient();
        if (loggedIn)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.Header, "tester@example.com");
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

        var download = await client.GetAsync(link);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/jpeg", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Image, await download.Content.ReadAsByteArrayAsync());
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
