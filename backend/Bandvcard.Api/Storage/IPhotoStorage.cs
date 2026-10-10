namespace Bandvcard.Api.Storage;

public interface IPhotoStorage
{
    Task SaveAsync(string key, Stream content, long size, string contentType, CancellationToken cancellationToken);

    // Returns the content type, or null if there is no object with this key.
    Task<string?> GetContentTypeAsync(string key, CancellationToken cancellationToken);

    Task CopyToAsync(string key, Stream destination, CancellationToken cancellationToken);

    // Deleting a key that does not exist is not an error.
    Task DeleteAsync(string key, CancellationToken cancellationToken);
}
