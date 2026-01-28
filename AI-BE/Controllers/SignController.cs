using AI_BE.Data;
using AI_BE.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SignController : ControllerBase
{
    private readonly AppDbContext _context;

    public SignController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetSigns()
    {
        var signs = await _context.SignSamples.ToListAsync();
        return Ok(signs);
    }

    [HttpPost]
    public async Task<IActionResult> SaveSign([FromBody] SignSample sign)
    {
        if (sign == null)
            return BadRequest("Sign data is null");

        // Simple validation
        if (string.IsNullOrWhiteSpace(sign.SignName))
            return BadRequest("Sign name is required");

        _context.SignSamples.Add(sign);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSigns), new { id = sign.Id }, sign);
    }
}
