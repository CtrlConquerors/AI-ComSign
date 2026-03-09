namespace AI_BE.DTO;

public class AttemptDto
{
    public string SignName { get; set; } = string.Empty;
    public float Score { get; set; }
    public bool Passed { get; set; }
    public bool IsSkipped { get; set; }
}
