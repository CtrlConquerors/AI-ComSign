using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AI_BE.Models;

public class SignSample
{
    [Key]
    public int Id { get; set; }
    public required string SignName { get; set; }
    public string? FileName { get; set; }

    [Column(TypeName = "jsonb")]
    public required List<Landmark> Landmarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Landmark
{
    public float X { get; set; }
    public float Y { get; set; }
    public float Z { get; set; }
    public float? Visibility { get; set; }
}
