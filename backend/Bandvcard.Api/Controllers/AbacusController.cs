using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bandvcard.Api.Controllers;

// What the Abacus import (the n8n workflow with the API key) reports back.
[ApiController]
[Route("api/abacus")]
[Authorize(Roles = Roles.Integration)]
public class AbacusController(BandvcardDbContext db, TimeProvider timeProvider) : ControllerBase
{
    // Called after a released contact has been transferred to Abacus: sets the status
    // "übernommen" and the date of the transfer. Calling it again changes nothing, so a
    // workflow can safely repeat it.
    [IntegrationWrite]
    [HttpPost("contacts/{id:guid}/imported")]
    public async Task<IActionResult> MarkImported(Guid id)
    {
        var contact = await db.Contacts.FirstOrDefaultAsync(
            c => c.Id == id && c.AbacusStatus != AbacusStatus.None);
        // Not released by a person: there was nothing to import.
        if (contact is null)
        {
            return NotFound();
        }

        if (contact.AbacusStatus == AbacusStatus.ToImport)
        {
            contact.AbacusStatus = AbacusStatus.Imported;
            contact.AbacusImportedAt = timeProvider.GetUtcNow();
            await db.SaveChangesAsync();
        }

        return Ok(new { id = contact.Id, abacusStatus = contact.AbacusStatus.ToString(), abacusImportedAt = contact.AbacusImportedAt });
    }
}
