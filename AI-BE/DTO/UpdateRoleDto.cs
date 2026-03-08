using System.ComponentModel.DataAnnotations;

namespace AI_BE.DTO
{
    public class UpdateRoleDto
    {
        [Required]
        public string Role { get; set; } = string.Empty;
    }
}
