using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Deltas;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.OData.Results;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Microsoft.EntityFrameworkCore;

namespace Bandvcard.Api.Controllers;

// Everyone may read the directory; changing it directly is for admins.
// (Saving a contact still adds unknown postal codes, see ContactsController.)
public class PostalCodesController(BandvcardDbContext db) : ODataController
{
    [EnableQuery(PageSize = 100)]
    public IQueryable<PostalCodeEntry> Get() => db.PostalCodes;

    [EnableQuery]
    public SingleResult<PostalCodeEntry> Get(string key) =>
        SingleResult.Create(db.PostalCodes.Where(e => e.PostalCode == key));

    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Post([FromBody] PostalCodeEntry entry)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (await db.PostalCodes.AnyAsync(e => e.PostalCode == entry.PostalCode))
        {
            return Conflict($"Postal code '{entry.PostalCode}' already exists.");
        }

        db.PostalCodes.Add(entry);
        await db.SaveChangesAsync();
        return Created(entry);
    }

    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Patch(string key, [FromBody] Delta<PostalCodeEntry> delta)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var entry = await db.PostalCodes.FindAsync(key);
        if (entry is null)
        {
            return NotFound();
        }

        delta.Patch(entry);
        if (entry.PostalCode != key)
        {
            return BadRequest("The postal code is the entry's key and cannot be changed.");
        }

        await db.SaveChangesAsync();
        return Updated(entry);
    }

    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(string key)
    {
        var entry = await db.PostalCodes.FindAsync(key);
        if (entry is null)
        {
            return NotFound();
        }

        if (await db.Contacts.AnyAsync(c => c.PostalCode == key))
        {
            return Conflict($"Postal code '{key}' is still used by contacts.");
        }

        db.PostalCodes.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
