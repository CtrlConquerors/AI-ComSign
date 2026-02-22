using Microsoft.AspNetCore.Mvc;
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
            .Include(l => l.Signs) 
            .OrderBy(l => l.Id)
            .ToListAsync();
    }


    [HttpGet("{id}")]
    public async Task<ActionResult<Lesson>> GetById(int id)
    {
        var lesson = await _context.Lessons
            .Include(l => l.Signs)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (lesson == null) return NotFound(new { message = "Không tìm thấy bài học." });

        return lesson;
    }


    [HttpPost]
    public async Task<ActionResult<Lesson>> Create(Lesson lesson)
    {
        _context.Lessons.Add(lesson);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = lesson.Id }, lesson);
    }


    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Lesson updatedLesson)
    {
        if (id != updatedLesson.Id) return BadRequest(new { message = "ID không khớp." });

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
            if (!LessonExists(id)) return NotFound();
            else throw;
        }

        return NoContent();
    }

 
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson == null) return NotFound();

        _context.Lessons.Remove(lesson);
        await _context.SaveChangesAsync();

        return NoContent();
    }


    [HttpPost("{id}/add-signs")]
    public async Task<IActionResult> AddSignsToLesson(int id, [FromBody] List<int> signIds)
    {
        var lesson = await _context.Lessons.Include(l => l.Signs).FirstOrDefaultAsync(l => l.Id == id);
        if (lesson == null) return NotFound();

        var signsToAdd = await _context.SignSamples
            .Where(s => signIds.Contains(s.Id))
            .ToListAsync();

        foreach (var sign in signsToAdd)
        {
            sign.LessonId = id;
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = $"Đã thêm {signsToAdd.Count} ký hiệu vào bài học {lesson.Title}" });
    }

    [HttpPost("{lessonId}/assign-by-names")]
    public async Task<IActionResult> AssignSignsByNames(int lessonId, [FromBody] List<string> signNames)
    {
        var lesson = await _context.Lessons.FindAsync(lessonId);
        if (lesson == null)
        {
            return NotFound(new { message = "Không tìm thấy bài học." });
        }

        var signs = await _context.SignSamples
            .Where(s => signNames.Contains(s.SignName))
            .ToListAsync();

        if (!signs.Any())
        {
            return NotFound(new { message = "Không tìm thấy ký hiệu nào với danh sách tên đã cung cấp." });
        }

        foreach (var sign in signs)
        {
            sign.LessonId = lessonId;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Đã gán thành công {signs.Count} ký hiệu vào bài học: {lesson.Title}",
            assignedSigns = signs.Select(s => s.SignName)
        });
    }

    private bool LessonExists(int id) => _context.Lessons.Any(e => e.Id == id);
}