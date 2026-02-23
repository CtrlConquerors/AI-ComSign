using AI_BE.Models;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

public class Lesson
{
    [Key]
    public int Id { get; set; }
    public required string Title { get; set; } 
    public string? Description { get; set; } 
    public string? Level { get; set; }

    [JsonIgnore]
    public List<SignSample> Signs { get; set; } = new();
}