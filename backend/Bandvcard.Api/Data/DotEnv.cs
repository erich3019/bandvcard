namespace Bandvcard.Api.Data;

// Lets a local `dotnet run` or `dotnet ef` use the same .env file as Docker Compose,
// so passwords live in one place. In containers there is no .env and this does nothing.
public static class DotEnv
{
    public static void Load(string startDirectory)
    {
        var path = Find(startDirectory);
        if (path is null)
        {
            return;
        }

        foreach (var line in File.ReadAllLines(path))
        {
            var trimmed = line.Trim();
            var separator = trimmed.IndexOf('=');
            if (trimmed.StartsWith('#') || separator <= 0)
            {
                continue;
            }

            var key = trimmed[..separator].Trim();
            var value = trimmed[(separator + 1)..].Trim().Trim('"');
            // Real environment variables win over the file.
            if (Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    public static void ApplyTo(IConfiguration configuration)
    {
        static string? Env(string name) =>
            Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : null;

        if (configuration.GetConnectionString("Default") is null && Env("POSTGRES_PASSWORD") is { } password)
        {
            configuration["ConnectionStrings:Default"] =
                $"Host={Env("POSTGRES_HOST") ?? "localhost"};Port={Env("POSTGRES_PORT") ?? "5433"};" +
                $"Database={Env("POSTGRES_DB")};Username={Env("POSTGRES_USER")};Password={password}";
        }

        configuration["Entra:TenantId"] ??= Env("ENTRA_TENANT_ID");
        configuration["Entra:ClientId"] ??= Env("ENTRA_CLIENT_ID");
        configuration["Entra:ClientSecret"] ??= Env("ENTRA_CLIENT_SECRET");
        configuration["Auth:DevLoginEmail"] ??= Env("DEV_LOGIN_EMAIL");
        configuration["Auth:AdminEmails"] ??= Env("ADMIN_EMAILS");

        if (Env("MINIO_ROOT_PASSWORD") is { } minioSecret)
        {
            configuration["Minio:Endpoint"] ??= $"localhost:{Env("MINIO_API_PORT") ?? "9000"}";
            configuration["Minio:AccessKey"] ??= Env("MINIO_ROOT_USER");
            configuration["Minio:SecretKey"] ??= minioSecret;
        }
    }

    private static string? Find(string startDirectory)
    {
        for (var directory = new DirectoryInfo(startDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }
}
