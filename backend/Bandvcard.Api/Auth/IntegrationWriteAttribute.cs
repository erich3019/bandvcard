namespace Bandvcard.Api.Auth;

// Marks the few actions the integration (API key) may call although they change data.
// Everything else that is not a read is refused for it in Program.cs.
[AttributeUsage(AttributeTargets.Method)]
public sealed class IntegrationWriteAttribute : Attribute;
