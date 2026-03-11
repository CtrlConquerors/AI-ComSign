using AI_BE.Data;
using AI_BE.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
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

    [Authorize(Roles = "Admin")]
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

    /// <summary>
    /// Get dataset statistics (count per sign)
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _context.SignSamples
            .GroupBy(s => s.SignName.ToLower())
            .Select(g => new
            {
                SignName = g.Key,
                Count = g.Count(),
            })
            .OrderBy(s => s.SignName)
            .ToListAsync();

        return Ok(stats);
    }

    /// <summary>
    /// Batch save multiple samples
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("batch")]
    public async Task<IActionResult> SaveBatch([FromBody] List<SignSample> samples)
    {
        if (samples == null || samples.Count == 0)
            return BadRequest("No samples provided");

        // Validate all samples
        foreach (var sample in samples)
        {
            if (string.IsNullOrWhiteSpace(sample.SignName))
                return BadRequest("All samples must have a sign name");
        }

        _context.SignSamples.AddRange(samples);
        await _context.SaveChangesAsync();

        return Ok(new { Saved = samples.Count });
    }

    /// <summary>
    /// Delete all samples for a specific sign
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpDelete("{signName}")]
    public async Task<IActionResult> DeleteBySign(string signName)
    {
        var samples = await _context.SignSamples
            .Where(s => s.SignName.ToLower() == signName.ToLower())
            .ToListAsync();

        if (samples.Count == 0)
            return NotFound($"No samples found for sign: {signName}");

        _context.SignSamples.RemoveRange(samples);
        await _context.SaveChangesAsync();

        return Ok(new { Deleted = samples.Count, SignName = signName });
    }

    [HttpGet("lesson/{lessonId}")]
    public async Task<IActionResult> GetSignsByLesson(int lessonId)
    {
        var signNames = await _context.LessonSigns
            .Where(ls => ls.LessonId == lessonId)
            .Select(ls => ls.SignName)
            .ToListAsync();

        var signs = await _context.SignSamples
            .Where(s => signNames.Contains(s.SignName))
            .OrderBy(s => s.SignName)
            .ToListAsync();

        return Ok(signs);
    }
}
