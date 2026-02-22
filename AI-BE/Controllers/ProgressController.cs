using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AI_BE.Data;
using AI_BE.Models;

namespace AI_BE.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProgressController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProgressController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{userId}/statistics")]
    public async Task<IActionResult> GetStatistics(int userId)
    {

        var userAttempts = await _context.Attempts
            .Include(a => a.Sign)
            .Where(a => a.Session!.LearnerId == userId)
            .ToListAsync();

        if (!userAttempts.Any()) return Ok(new { message = "Chưa có dữ liệu luyện tập." });

   
        var lessons = await _context.Lessons.Include(l => l.Signs).ToListAsync();
        int completedLessonsCount = 0;
        foreach (var lesson in lessons)
        {
            if (lesson.Signs.Count > 0)
            {
                var practicedSignIds = userAttempts
                    .Where(a => lesson.Signs.Select(s => s.Id).Contains(a.SignId))
                    .Select(a => a.SignId)
                    .Distinct()
                    .Count();

                if (practicedSignIds == lesson.Signs.Count) completedLessonsCount++;
            }
        }


        var highestScoresPerSign = userAttempts
            .GroupBy(a => a.Sign!.SignName)
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

    [HttpGet("{userId}/lecturer-summary")]
    public async Task<IActionResult> GetLecturerSummary(int userId)
    {
        var attempts = await _context.Attempts.Where(a => a.Session!.LearnerId == userId).ToListAsync();
        if (!attempts.Any()) return Ok("Bắt đầu luyện tập để nhận đánh giá từ giảng viên.");

        double avgScore = attempts.Average(a => a.Score);
        string evaluation = "";

        if (avgScore >= 80)
            evaluation = "Tuyệt vời! Bạn đã nắm vững các ký hiệu cơ bản. Hãy tiếp tục duy trì độ chính xác này.";
        else if (avgScore >= 50)
            evaluation = "Tiến bộ rất tốt. Bạn cần chú ý hơn đến các chi tiết nhỏ trong chuyển động tay để đạt điểm tối đa.";
        else
            evaluation = "Bạn cần dành thêm thời gian xem video demo và luyện tập kỹ các tư thế chuẩn.";

        var weakestSign = attempts
            .GroupBy(a => a.SignId)
            .Select(g => new { SignId = g.Key, Avg = g.Average(a => a.Score) })
            .OrderBy(g => g.Avg)
            .FirstOrDefault();

        if (weakestSign != null)
        {
            var signName = (await _context.SignSamples.FindAsync(weakestSign.SignId))?.SignName;
            evaluation += $" Đặc biệt, hãy tập trung cải thiện ký hiệu '{signName}'.";
        }

        return Ok(new { Summary = evaluation });
    }
}