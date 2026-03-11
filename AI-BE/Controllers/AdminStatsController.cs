using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AI_BE.Data;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminStatsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminStatsController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/admin/practice-stats
    [HttpGet("practice-stats")]
    public async Task<IActionResult> GetPracticeStats()
    {
        // --- Per Learner (DB-side join + group) ---
        var perLearner = await _context.PracticeSessions
            .Where(s => s.EndDate != null)
            .Join(_context.Learners, s => s.LearnerId, l => l.Id,
                (s, l) => new { s, LearnerName = l.Name })
            .GroupBy(x => new { x.s.LearnerId, x.LearnerName })
            .Select(g => new
            {
                learnerId = g.Key.LearnerId,
                name = g.Key.LearnerName,
                sessionCount = g.Count(),
                avgPassRate = Math.Round(g.Average(x => (double)x.s.PassRate), 1)
            })
            .OrderByDescending(x => x.sessionCount)
            .ToListAsync();

        // --- Per Lesson ---
        // "Hardest signs" requires nested grouping that EF can't fully translate;
        // load only session + attempt data for finished sessions (lean projection).
        var lessonSessions = await _context.PracticeSessions
            .Where(s => s.EndDate != null && s.LessonId != null)
            .Select(s => new
            {
                s.LessonId,
                LessonTitle = s.Lesson != null ? s.Lesson.Title : "Unknown",
                s.PassRate,
                Attempts = s.Attempts
                    .Where(a => !a.IsSkipped)
                    .Select(a => new { a.SignName, a.Passed })
                    .ToList()
            })
            .ToListAsync();

        var perLesson = lessonSessions
            .GroupBy(s => s.LessonId)
            .Select(g =>
            {
                var allAttempts = g.SelectMany(s => s.Attempts).ToList();

                var hardestSigns = allAttempts
                    .GroupBy(a => a.SignName)
                    .Select(sg => new
                    {
                        signName = sg.Key,
                        passRate = sg.Any() ? sg.Average(a => a.Passed ? 1.0 : 0.0) * 100 : 0
                    })
                    .OrderBy(x => x.passRate)
                    .Take(3)
                    .Select(x => x.signName)
                    .ToList();

                return new
                {
                    lessonId = g.Key,
                    title = g.First().LessonTitle,
                    avgPassRate = Math.Round(g.Average(s => (double)s.PassRate), 1),
                    hardestSigns
                };
            })
            .OrderBy(x => x.avgPassRate)
            .ToList();

        // --- Per Sign (DB-side group) ---
        var perSign = await _context.Attempts
            .Where(a => a.SignName != null && a.SignName != "")
            .GroupBy(a => a.SignName)
            .Select(g => new
            {
                signName = g.Key,
                totalAttempts = g.Count(),
                passCount = g.Count(a => a.Passed && !a.IsSkipped),
                skipCount = g.Count(a => a.IsSkipped),
            })
            .ToListAsync();

        var perSignResult = perSign
            .Select(g =>
            {
                var nonSkipped = g.totalAttempts - g.skipCount;
                return new
                {
                    g.signName,
                    g.totalAttempts,
                    g.passCount,
                    g.skipCount,
                    passRate = nonSkipped > 0 ? Math.Round((double)g.passCount / nonSkipped * 100, 1) : 0,
                    skipRate = g.totalAttempts > 0 ? Math.Round((double)g.skipCount / g.totalAttempts * 100, 1) : 0,
                };
            })
            .OrderBy(x => x.passRate)
            .ToList();

        return Ok(new { perLearner, perLesson, perSign = perSignResult });
    }
}
