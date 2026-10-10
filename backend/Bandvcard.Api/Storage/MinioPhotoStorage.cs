using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace Bandvcard.Api.Storage;

public class MinioOptions
{
    public string Endpoint { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string Bucket { get; set; } = "business-cards";
    public bool UseSsl { get; set; }
}

public class MinioPhotoStorage(MinioOptions options) : IPhotoStorage
{
    private readonly IMinioClient _client = new MinioClient()
        .WithEndpoint(options.Endpoint)
        .WithCredentials(options.AccessKey, options.SecretKey)
        .WithSSL(options.UseSsl)
        .Build();

    private bool _bucketChecked;

    public async Task SaveAsync(
        string key, Stream content, long size, string contentType, CancellationToken cancellationToken)
    {
        await EnsureBucketAsync(cancellationToken);
        await _client.PutObjectAsync(
            new PutObjectArgs()
                .WithBucket(options.Bucket)
                .WithObject(key)
                .WithStreamData(content)
                .WithObjectSize(size)
                .WithContentType(contentType),
            cancellationToken);
    }

    public async Task<string?> GetContentTypeAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            var stat = await _client.StatObjectAsync(
                new StatObjectArgs().WithBucket(options.Bucket).WithObject(key),
                cancellationToken);
            return stat.ContentType;
        }
        catch (Exception e) when (e is ObjectNotFoundException or BucketNotFoundException)
        {
            return null;
        }
    }

    public Task CopyToAsync(string key, Stream destination, CancellationToken cancellationToken) =>
        _client.GetObjectAsync(
            new GetObjectArgs()
                .WithBucket(options.Bucket)
                .WithObject(key)
                .WithCallbackStream((stream, token) => stream.CopyToAsync(destination, token)),
            cancellationToken);

    private async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        if (_bucketChecked)
        {
            return;
        }

        var exists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(options.Bucket), cancellationToken);
        if (!exists)
        {
            await _client.MakeBucketAsync(new MakeBucketArgs().WithBucket(options.Bucket), cancellationToken);
        }

        _bucketChecked = true;
    }
}
