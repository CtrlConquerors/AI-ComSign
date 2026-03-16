using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AI_BE.Models
{
    public class PasswordResetToken
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid LearnerId { get; set; }

        [Required]
        [MaxLength(256)]
        public string Token { get; set; } = string.Empty;

        public DateTime ExpirationTime { get; set; }

        public bool Used { get; set; } = false;

        // Navigation property
        [ForeignKey("LearnerId")]
        public Learner? Learner { get; set; }
    }
}
