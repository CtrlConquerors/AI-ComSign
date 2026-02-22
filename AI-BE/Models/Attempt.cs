using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AI_BE.Models;

public class Attempt
{
    [Key]
    public int Id { get; set; }
    public int SessionId { get; set; }

    [ForeignKey("SessionId")]
    public PracticeSession? Session { get; set; }

    public int SignId { get; set; }

    [ForeignKey("SignId")]
    public SignSample? Sign { get; set; }

    public float Score { get; set; }
    public string? Feedback { get; set; }

    [Column(TypeName = "jsonb")]
    public string? RecordMotionData { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}