using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Storage;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.OData;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

DotEnv.Load(builder.Environment.ContentRootPath);
DotEnv.ApplyTo(builder.Configuration);

// Add services to the container.

builder.Services.AddControllers().AddOData(options => options
    .EnableQueryFeatures(maxTopValue: 100)
    .AddRouteComponents("api", EdmModel.Build()));
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
builder.Services.AddDbContext<BandvcardDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.AddBandvcardAuth();
builder.Services.AddScoped<ContactVisibility>();
builder.Services.AddSingleton<IPhotoStorage>(_ => new MinioPhotoStorage(
    builder.Configuration.GetSection("Minio").Get<MinioOptions>() ?? new MinioOptions()));
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    // The backend is only reachable through the reverse proxy, whose address is not fixed.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.Logger.LogWarning(
        "Development environment: there is NO login, every request acts as the developer user. " +
        "Set ASPNETCORE_ENVIRONMENT=Production to require the Microsoft login.");
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

app.UseForwardedHeaders();
app.UseHttpsRedirection();

app.UseAuthentication();

// The integration (API key) is read-only, whatever endpoints exist now or are added later.
app.Use(async (context, next) =>
{
    if (context.User.IsInRole(Roles.Integration)
        && !HttpMethods.IsGet(context.Request.Method)
        && !HttpMethods.IsHead(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }

    await next(context);
});
app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory in the test project.
public partial class Program;
