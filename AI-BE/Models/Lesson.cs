using AI_BE.Models;
using System.ComponentModel.DataAnnotations;

public class Lesson
{
    [Key]
    public int Id { get; set; }
    public required string Title { get; set; } 
    public string? Description { get; set; } 
    public string? Level { get; set; }

    public List<SignSample> Signs { get; set; } = new();
}