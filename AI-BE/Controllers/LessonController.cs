using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using AI_BE.Models;
using AI_BE.Data;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LessonsController : ControllerBase
{
    private readonly AppDbContext _context;

    public LessonsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Lesson>>> GetAll()
    {
        return await _context.Lessons
            .OrderBy(l => l.Id)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Lesson>> GetById(int id)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson == null) return NotFound(new { message = "Lesson not found." });
        return lesson;
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<Lesson>> Create(Lesson lesson)
    {
        _context.Lessons.Add(lesson);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = lesson.Id }, lesson);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Lesson updatedLesson)
    {
        if (id != updatedLesson.Id) return BadRequest(new { message = "ID mismatch." });

        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson == null) return NotFound();

        lesson.Title = updatedLesson.Title;
        lesson.Description = updatedLesson.Description;
        lesson.Level = updatedLesson.Level;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _context.Lessons.AnyAsync(l => l.Id == id)) return NotFound();
            else throw;
        }

        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson == null) return NotFound();

        _context.Lessons.Remove(lesson);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Assign signs to a lesson by sign sample IDs (looks up sign name from sample).
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("{id}/add-signs")]
    public async Task<IActionResult> AddSignsToLesson(int id, [FromBody] List<int> signIds)
    {
        var lesson = await _context.Lessons
            .Include(l => l.LessonSigns)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (lesson == null) return NotFound();

        var samples = await _context.SignSamples
            .Where(s => signIds.Contains(s.Id))
            .ToListAsync();

        var existingNames = lesson.LessonSigns.Select(ls => ls.SignName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var newNames = samples
            .Select(s => s.SignName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(n => !existingNames.Contains(n));

        foreach (var name in newNames)
        {
            lesson.LessonSigns.Add(new LessonSign { LessonId = id, SignName = name });
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = $"Added {lesson.LessonSigns.Count(ls => !existingNames.Contains(ls.SignName))} sign(s) to lesson '{lesson.Title}'." });
    }

    /// <summary>
    /// Assign signs to a lesson by sign name. A sign can be in multiple lessons.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("{lessonId}/assign-by-names")]
    public async Task<IActionResult> AssignSignsByNames(int lessonId, [FromBody] List<string> signNames)
    {
        var lesson = await _context.Lessons.FindAsync(lessonId);
        if (lesson == null) return NotFound(new { message = "Lesson not found." });

        var existing = await _context.LessonSigns
            .Where(ls => ls.LessonId == lessonId)
            .Select(ls => ls.SignName)
            .ToListAsync();

        var existingSet = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var toAdd = signNames
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(n => !existingSet.Contains(n))
            .ToList();

        if (toAdd.Count == 0)
            return Ok(new { message = "All specified signs are already in this lesson.", assignedSigns = signNames });

        _context.LessonSigns.AddRange(toAdd.Select(n => new LessonSign { LessonId = lessonId, SignName = n }));
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Added {toAdd.Count} sign(s) to lesson '{lesson.Title}'.",
            assignedSigns = toAdd
        });
    }

    /// <summary>
    /// Remove a sign from a lesson (does not affect other lessons or training data).
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpDelete("{lessonId}/signs/by-name/{signName}")]
    public async Task<IActionResult> RemoveSignFromLesson(int lessonId, string signName)
    {
        var lessonSign = await _context.LessonSigns
            .FirstOrDefaultAsync(ls => ls.LessonId == lessonId &&
                                       ls.SignName.ToLower() == signName.ToLower());

        if (lessonSign == null) return NotFound(new { message = "Sign not found in this lesson." });

        _context.LessonSigns.Remove(lessonSign);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// List all lessons that contain a specific sign name.
    /// </summary>
    [HttpGet("by-sign/{signName}")]
    public async Task<IActionResult> GetLessonsForSign(string signName)
    {
        var lessons = await _context.LessonSigns
            .Where(ls => ls.SignName.ToLower() == signName.ToLower())
            .Include(ls => ls.Lesson)
            .Select(ls => new { ls.Lesson.Id, ls.Lesson.Title, ls.Lesson.Level, ls.Lesson.Description })
            .ToListAsync();

        return Ok(lessons);
    }
}
