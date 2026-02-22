using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AI_BE.Models;
using AI_BE.Data;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PracticeSessionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PracticeSessionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("start")]
    public async Task<ActionResult<PracticeSession>> StartSession([FromBody] int learnerId)
    {
        var session = new PracticeSession
        {
            LearnerId = learnerId,
            StartDate = DateTime.UtcNow,
            TotalScore = 0
        };

        _context.PracticeSessions.Add(session);
        await _context.SaveChangesAsync();

        return Ok(session);
    }

    [HttpPost("{sessionId}/attempts")]
    public async Task<ActionResult<Attempt>> RecordAttempt(int sessionId, [FromBody] Attempt attempt)
    {
        var session = await _context.PracticeSessions.FindAsync(sessionId);
        if (session == null) return NotFound("Không tìm thấy");

        attempt.SessionId = sessionId;
        _context.Attempts.Add(attempt);
        await _context.SaveChangesAsync();

        return Ok(attempt);
    }

    [HttpPost("{sessionId}/finish")]
    public async Task<IActionResult> FinishSession(int sessionId)
    {
        var session = await _context.PracticeSessions
            .Include(s => s.Attempts)
            .FirstOrDefaultAsync(s => s.Id == sessionId);

        if (session == null) return NotFound();

        session.EndDate = DateTime.UtcNow;
        if (session.Attempts.Any())
        {
            session.TotalScore = (decimal)session.Attempts.Average(a => a.Score);
        }

        await _context.SaveChangesAsync();
        return Ok(session);
    }

    [HttpGet("history/{learnerId}")]
    public async Task<ActionResult<IEnumerable<PracticeSession>>> GetHistory(int learnerId)
    {
        return await _context.PracticeSessions
            .Where(s => s.LearnerId == learnerId)
            .Include(s => s.Attempts)
            .ThenInclude(a => a.Sign)
            .OrderByDescending(s => s.StartDate)
            .ToListAsync();
    }
}