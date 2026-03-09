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
        var sessions = await _context.PracticeSessions
            .Include(s => s.Lesson)
            .Include(s => s.Attempts)
            .Where(s => s.EndDate != null)
            .ToListAsync();

        var learners = await _context.Learners.ToListAsync();

        // --- Per Learner ---
        var perLearner = sessions
            .GroupBy(s => s.LearnerId)
            .Select(g =>
            {
                var learner = learners.FirstOrDefault(l => l.Id == g.Key);
                return new
                {
                    learnerId = g.Key,
                    name = learner?.Name ?? "Unknown",
                    sessionCount = g.Count(),
                    avgPassRate = g.Any() ? Math.Round(g.Average(s => (double)s.PassRate), 1) : 0.0
                };
            })
            .OrderByDescending(x => x.sessionCount)
            .ToList();

        // --- Per Lesson ---
        var perLesson = sessions
            .Where(s => s.LessonId != null)
            .GroupBy(s => s.LessonId)
            .Select(g =>
            {
                var lesson = g.First().Lesson;

                // All attempts across all sessions for this lesson
                var allAttempts = g.SelectMany(s => s.Attempts).ToList();

                // Hardest signs = bottom 3 by pass rate
                var signPassRates = allAttempts
                    .Where(a => !a.IsSkipped)
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
                    title = lesson?.Title ?? "Unknown",
                    avgPassRate = g.Any() ? Math.Round(g.Average(s => (double)s.PassRate), 1) : 0.0,
                    hardestSigns = signPassRates
                };
            })
            .OrderBy(x => x.avgPassRate)
            .ToList();

        // --- Per Sign (all signs, sorted by pass rate) ---
        var allAttemptsList = await _context.Attempts.ToListAsync();

        var perSign = allAttemptsList
            .GroupBy(a => a.SignName)
            .Where(g => !string.IsNullOrEmpty(g.Key))
            .Select(g =>
            {
                var total = g.Count();
                var passCount = g.Count(a => a.Passed && !a.IsSkipped);
                var skipCount = g.Count(a => a.IsSkipped);
                var nonSkipped = total - skipCount;
                var passRate = nonSkipped > 0 ? Math.Round((double)passCount / nonSkipped * 100, 1) : 0;
                var skipRate = total > 0 ? Math.Round((double)skipCount / total * 100, 1) : 0;

                return new
                {
                    signName = g.Key,
                    totalAttempts = total,
                    passCount,
                    skipCount,
                    passRate,
                    skipRate
                };
            })
            .OrderBy(x => x.passRate)
            .ToList();

        return Ok(new { perLearner, perLesson, perSign });
    }
}
