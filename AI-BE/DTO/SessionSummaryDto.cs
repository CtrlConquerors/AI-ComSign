namespace AI_BE.DTO;

public class SessionSummaryDto
{
    public int SessionId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    public int TotalSigns { get; set; }
    public int PassedSigns { get; set; }
    public decimal PassRate { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<AttemptSummaryDto> Attempts { get; set; } = new();
}

public class AttemptSummaryDto
{
    public string SignName { get; set; } = string.Empty;
    public float Score { get; set; }
    public bool Passed { get; set; }
    public bool IsSkipped { get; set; }
}
