namespace AI_BE.DTO;

public class SessionStartedDto
{
    public int SessionId { get; set; }
    public List<string> SignNames { get; set; } = new();
}
