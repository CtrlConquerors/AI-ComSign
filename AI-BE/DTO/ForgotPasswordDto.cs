using System.ComponentModel.DataAnnotations;

namespace AI_BE.DTO
{
    public class ForgotPasswordDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }
}
