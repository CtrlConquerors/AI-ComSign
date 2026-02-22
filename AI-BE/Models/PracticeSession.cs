using System.ComponentModel.DataAnnotations;

namespace AI_BE.Models;

public class PracticeSession
{
    [Key]
    public int Id { get; set; }
    public int LearnerId { get; set; }
    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime? EndDate { get; set; }
    public decimal TotalScore { get; set; }
    public List<Attempt> Attempts { get; set; } = new();
}