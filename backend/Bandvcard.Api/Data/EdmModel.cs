using Bandvcard.Api.Entities;
using Microsoft.OData.Edm;
using Microsoft.OData.ModelBuilder;

namespace Bandvcard.Api.Data;

public static class EdmModel
{
    // Entity set names must match the controller names for OData convention routing.
    public static IEdmModel Build()
    {
        var builder = new ODataConventionModelBuilder();
        builder.EnableLowerCamelCase();

        builder.EntitySet<Contact>("Contacts");
        builder.EntitySet<User>("Users").EntityType.HasKey(u => u.Email);
        builder.EntitySet<PostalCodeEntry>("PostalCodes").EntityType.HasKey(e => e.PostalCode);

        return builder.GetEdmModel();
    }
}
