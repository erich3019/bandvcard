using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;

namespace Bandvcard.Api.Storage;

// Contact.PhotoLink holds the URL under which PhotosController serves a stored photo.
// This is the one place that knows how such a link and the storage key relate.
public static partial class PhotoLinks
{
    private const string Prefix = "/api/photos/";

    [GeneratedRegex(@"^\d{4}/\d{2}/[0-9a-f]{32}\.(jpg|png|webp)$")]
    private static partial Regex KeyPattern();

    public static bool IsKey(string key) => KeyPattern().IsMatch(key);

    public static string ToLink(string key) => Prefix + key;

    // False for links that do not point to a photo in our storage, e.g. an external URL.
    public static bool TryGetKey(string? photoLink, [NotNullWhen(true)] out string? key)
    {
        key = photoLink?.StartsWith(Prefix, StringComparison.Ordinal) == true ? photoLink[Prefix.Length..] : null;
        if (key is not null && IsKey(key))
        {
            return true;
        }

        key = null;
        return false;
    }
}
