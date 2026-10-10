using Bandvcard.Api.Auth;
using Bandvcard.Api.Data;
using Bandvcard.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Deltas;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.OData.Results;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Microsoft.EntityFrameworkCore;

namespace Bandvcard.Api.Controllers;

public class UsersController(BandvcardDbContext db) : ODataController
{
    [EnableQuery(PageSize = 100)]
    public IQueryable<User> Get() => db.Users;

    [EnableQuery]
    public SingleResult<User> Get(string key) =>
        SingleResult.Create(db.Users.Where(u => u.Email == key));

    public async Task<IActionResult> Post([FromBody] User user)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // Same normalisation as on login, so both paths refer to the same user.
        user.Email = UserSignInService.NormalizeEmail(user.Email);
        if (await db.Users.AnyAsync(u => u.Email == user.Email))
        {
            return Conflict($"A user with the email address '{user.Email}' already exists.");
        }

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Created(user);
    }

    public async Task<IActionResult> Patch(string key, [FromBody] Delta<User> delta)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var user = await db.Users.FindAsync(key);
        if (user is null)
        {
            return NotFound();
        }

        delta.Patch(user);
        if (user.Email != key)
        {
            return BadRequest("The email address is the user's key and cannot be changed.");
        }

        await db.SaveChangesAsync();
        return Updated(user);
    }

    public async Task<IActionResult> Delete(string key)
    {
        var user = await db.Users.FindAsync(key);
        if (user is null)
        {
            return NotFound();
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
