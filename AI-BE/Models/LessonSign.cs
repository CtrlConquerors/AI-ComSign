namespace AI_BE.Models;

public class LessonSign
{
    public int LessonId { get; set; }
    public Lesson Lesson { get; set; } = null!;

    public string SignName { get; set; } = string.Empty;
}
