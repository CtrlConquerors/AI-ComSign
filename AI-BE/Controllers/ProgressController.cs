using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AI_BE.Data;
using AI_BE.Models;

using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProgressController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProgressController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("statistics")]
    public async Task<IActionResult> GetStatistics()
    {
        var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(idClaim) || !Guid.TryParse(idClaim, out var userId))
            return Unauthorized();

        var userAttempts = await _context.Attempts
            .Where(a => a.Session!.LearnerId == userId)
            .Select(a => new { a.SignName, a.Score, a.CreatedAt })
            .ToListAsync();

        if (!userAttempts.Any()) return Ok(new { message = "Chưa có dữ liệu luyện tập." });

        var lessons = await _context.Lessons.Include(l => l.LessonSigns).ToListAsync();
        int completedLessonsCount = 0;
        foreach (var lesson in lessons)
        {
            if (lesson.LessonSigns.Count > 0)
            {
                var lessonSignNames = lesson.LessonSigns.Select(ls => ls.SignName).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var practicedCount = userAttempts
                    .Where(a => a.SignName != null && lessonSignNames.Contains(a.SignName))
                    .Select(a => a.SignName)
                    .Distinct()
                    .Count();

                if (practicedCount == lesson.LessonSigns.Count) completedLessonsCount++;
            }
        }

        var highestScoresPerSign = userAttempts
            .Where(a => !string.IsNullOrEmpty(a.SignName))
            .GroupBy(a => a.SignName)
            .Select(g => new { SignName = g.Key, MaxScore = g.Max(a => a.Score) })
            .ToList();

        var progressTimeline = userAttempts
            .GroupBy(a => a.CreatedAt.Date)
            .Select(g => new {
                Date = g.Key.ToString("yyyy-MM-dd"),
                AverageScore = g.Average(a => a.Score),
                AttemptCount = g.Count()
            })
            .OrderBy(g => g.Date)
            .ToList();

        return Ok(new
        {
            CompletedLessons = completedLessonsCount,
            HighestScores = highestScoresPerSign,
            Timeline = progressTimeline
        });
    }

    [HttpGet("lecturer-summary")]
    public async Task<IActionResult> GetLecturerSummary()
    {
        var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(idClaim) || !Guid.TryParse(idClaim, out var userId))
            return Unauthorized();

        var attempts = await _context.Attempts
            .Where(a => a.Session!.LearnerId == userId)
            .Select(a => new { a.SignId, a.Score })
            .ToListAsync();

        if (!attempts.Any()) return Ok(new { Summary = "Bắt đầu luyện tập để nhận đánh giá từ giảng viên." });

        double avgScore = attempts.Average(a => a.Score);
        string evaluation;

        if (avgScore >= 80)
            evaluation = "Tuyệt vời! Bạn đã nắm vững các ký hiệu cơ bản. Hãy tiếp tục duy trì độ chính xác này.";
        else if (avgScore >= 50)
            evaluation = "Tiến bộ rất tốt. Bạn cần chú ý hơn đến các chi tiết nhỏ trong chuyển động tay để đạt điểm tối đa.";
        else
            evaluation = "Bạn cần dành thêm thời gian xem video demo và luyện tập kỹ các tư thế chuẩn.";

        var weakestSign = attempts
            .Where(a => a.SignId != null)
            .GroupBy(a => a.SignId)
            .Select(g => new { SignId = g.Key, Avg = g.Average(a => a.Score) })
            .OrderBy(g => g.Avg)
            .FirstOrDefault();

        if (weakestSign?.SignId != null)
        {
            var signName = (await _context.SignSamples.FindAsync(weakestSign.SignId))?.SignName;
            evaluation += $" Đặc biệt, hãy tập trung cải thiện ký hiệu '{signName}'.";
        }

        return Ok(new { Summary = evaluation });
    }
}
