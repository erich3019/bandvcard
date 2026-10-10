using Bandvcard.Api.Storage;
using Microsoft.AspNetCore.Mvc;

namespace Bandvcard.Api.Controllers;

// Business card photos. They are stored in MinIO and only reachable through this
// controller, so they are covered by the login like the rest of the API.
[ApiController]
[Route("api/photos")]
public class PhotosController(IPhotoStorage storage, TimeProvider timeProvider) : ControllerBase
{
    public const long MaxSize = 15 * 1024 * 1024;

    private static readonly Dictionary<string, string> Extensions = new()
    {
        ["image/jpeg"] = "jpg",
        ["image/png"] = "png",
        ["image/webp"] = "webp",
    };

    // Returns the link to store in Contact.PhotoLink.
    [HttpPost]
    [RequestSizeLimit(MaxSize + 64 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > MaxSize)
        {
            return BadRequest($"The photo must be between 1 byte and {MaxSize / 1024 / 1024} MB.");
        }

        if (!Extensions.TryGetValue(file.ContentType, out var extension))
        {
            return BadRequest("Only JPEG, PNG and WebP images are accepted.");
        }

        var now = timeProvider.GetUtcNow();
        var key = $"{now:yyyy}/{now:MM}/{Guid.NewGuid():N}.{extension}";
        await using var stream = file.OpenReadStream();
        await storage.SaveAsync(key, stream, file.Length, file.ContentType, cancellationToken);

        return Ok(new { photoLink = PhotoLinks.ToLink(key) });
    }

    [HttpGet("{**key}")]
    public async Task<IActionResult> Get(string key, CancellationToken cancellationToken)
    {
        if (!PhotoLinks.IsKey(key))
        {
            return NotFound();
        }

        var contentType = await storage.GetContentTypeAsync(key, cancellationToken);
        if (contentType is null)
        {
            return NotFound();
        }

        Response.ContentType = contentType;
        Response.Headers.CacheControl = "private, max-age=86400";
        await storage.CopyToAsync(key, Response.Body, cancellationToken);
        return new EmptyResult();
    }
}
