using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AI_BE.Models;

public class PracticeSession
{
    [Key]
    public int Id { get; set; }
    public Guid LearnerId { get; set; }
    public int? LessonId { get; set; }

    [ForeignKey("LessonId")]
    public Lesson? Lesson { get; set; }

    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime? EndDate { get; set; }
    public int TotalSigns { get; set; } = 0;
    public int PassedSigns { get; set; } = 0;
    public decimal PassRate { get; set; } = 0;
    public List<Attempt> Attempts { get; set; } = new();
}
