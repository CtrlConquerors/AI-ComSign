using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using AI_BE.Data;
using AI_BE.DTO;
using AI_BE.Models;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PracticeSessionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PracticeSessionsController(AppDbContext context)
    {
        _context = context;
    }

    private Guid GetCallerId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.Parse(id!);
    }

    // POST /api/practicesessions
    [HttpPost]
    public async Task<ActionResult<SessionStartedDto>> StartSession([FromBody] StartSessionDto dto)
    {
        var lesson = await _context.Lessons
            .Include(l => l.Signs)
            .FirstOrDefaultAsync(l => l.Id == dto.LessonId);

        if (lesson == null) return NotFound("Lesson not found.");
        if (lesson.Signs.Count == 0) return BadRequest("Lesson has no signs to practice.");

        var session = new PracticeSession
        {
            LearnerId = GetCallerId(),
            LessonId = dto.LessonId,
            StartDate = DateTime.UtcNow,
        };

        _context.PracticeSessions.Add(session);
        await _context.SaveChangesAsync();

        var signNames = lesson.Signs
            .Select(s => s.SignName)
            .Distinct()
            .ToList();

        return Ok(new SessionStartedDto
        {
            SessionId = session.Id,
            SignNames = signNames
        });
    }

    // POST /api/practicesessions/{id}/attempts
    [HttpPost("{id}/attempts")]
    public async Task<IActionResult> RecordAttempt(int id, [FromBody] AttemptDto dto)
    {
        var session = await _context.PracticeSessions.FindAsync(id);
        if (session == null) return NotFound("Session not found.");
        if (session.LearnerId != GetCallerId()) return Forbid();

        // Optionally resolve SignId by name (best-effort; null if not found)
        var sign = await _context.SignSamples
            .FirstOrDefaultAsync(s => s.SignName == dto.SignName);

        var attempt = new Attempt
        {
            SessionId = id,
            SignId = sign?.Id,
            SignName = dto.SignName,
            Score = dto.Score,
            Passed = dto.Passed,
            IsSkipped = dto.IsSkipped,
            CreatedAt = DateTime.UtcNow
        };

        _context.Attempts.Add(attempt);
        await _context.SaveChangesAsync();

        return Ok(new { attempt.Id });
    }

    // POST /api/practicesessions/{id}/finish
    [HttpPost("{id}/finish")]
    public async Task<ActionResult<SessionSummaryDto>> FinishSession(int id)
    {
        var session = await _context.PracticeSessions
            .Include(s => s.Lesson)
                .ThenInclude(l => l!.Signs)
            .Include(s => s.Attempts)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (session == null) return NotFound("Session not found.");
        if (session.LearnerId != GetCallerId()) return Forbid();

        // TotalSigns = distinct sign names in the lesson (not raw sample count)
        int totalSigns = session.Lesson?.Signs.Select(s => s.SignName).Distinct().Count() ?? 0;
        int passedSigns = session.Attempts.Count(a => a.Passed && !a.IsSkipped);
        decimal passRate = totalSigns > 0
            ? Math.Round((decimal)passedSigns / totalSigns * 100, 1)
            : 0;

        session.TotalSigns = totalSigns;
        session.PassedSigns = passedSigns;
        session.PassRate = passRate;
        session.EndDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new SessionSummaryDto
        {
            SessionId = session.Id,
            LessonTitle = session.Lesson?.Title ?? string.Empty,
            TotalSigns = totalSigns,
            PassedSigns = passedSigns,
            PassRate = passRate,
            StartDate = session.StartDate,
            EndDate = session.EndDate,
            Attempts = session.Attempts.Select(a => new AttemptSummaryDto
            {
                SignName = a.SignName,
                Score = a.Score,
                Passed = a.Passed,
                IsSkipped = a.IsSkipped
            }).ToList()
        });
    }

    // GET /api/practicesessions/history
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var learnerId = GetCallerId();

        var sessions = await _context.PracticeSessions
            .Where(s => s.LearnerId == learnerId)
            .Include(s => s.Lesson)
            .Include(s => s.Attempts)
            .OrderByDescending(s => s.StartDate)
            .Select(s => new
            {
                s.Id,
                LessonTitle = s.Lesson != null ? s.Lesson.Title : "Unknown",
                s.StartDate,
                s.EndDate,
                s.TotalSigns,
                s.PassedSigns,
                s.PassRate,
                Attempts = s.Attempts.Select(a => new
                {
                    a.SignName,
                    a.Score,
                    a.Passed,
                    a.IsSkipped
                })
            })
            .ToListAsync();

        return Ok(sessions);
    }
}
