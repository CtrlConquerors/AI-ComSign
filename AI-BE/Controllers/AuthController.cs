using AI_BE.Data;
using AI_BE.DTO;
using AI_BE.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AI_BE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IPasswordHasher<Learner> _passwordHasher;

        public AuthController(AppDbContext context, IConfiguration config, IPasswordHasher<Learner> passwordHasher)
        {
            _context = context;
            _config = config;
            _passwordHasher = passwordHasher;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterLearnerDto dto)
        {
            if (await _context.Learners.AnyAsync(l => l.Email == dto.Email))
            {
                return BadRequest("Email is already registered.");
            }

            var learner = new Learner
            {
                Email = dto.Email,
                Name = dto.Name,
                PhoneNumber = dto.PhoneNumber,
                DateOfBirth = dto.DateOfBirth.ToUniversalTime(),
                CreatedAt = DateTime.UtcNow
            };

            learner.PasswordHash = _passwordHasher.HashPassword(learner, dto.Password);

            _context.Learners.Add(learner);
            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(learner);

            return Ok(new { token, message = "Registration successful." });
        }

        [HttpPost("login")]
        [EnableRateLimiting("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var learner = await _context.Learners.FirstOrDefaultAsync(l => l.Email == dto.Email);

            if (learner == null || _passwordHasher.VerifyHashedPassword(learner, learner.PasswordHash, dto.Password) == PasswordVerificationResult.Failed)
            {
                return Unauthorized("Invalid email or password.");
            }

            var token = GenerateJwtToken(learner);

            return Ok(new { token, message = "Login successful." });
        }

        private string GenerateJwtToken(Learner learner)
        {
            var authClaims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, learner.Name),
                new Claim(ClaimTypes.Email, learner.Email),
                new Claim(ClaimTypes.NameIdentifier, learner.Id.ToString()),
                new Claim("PhoneNumber", learner.PhoneNumber ?? ""),
                new Claim("DateOfBirth", learner.DateOfBirth.ToString("yyyy-MM-dd")),
                new Claim(ClaimTypes.Role, learner.Role)
            };

            var jwtKey = _config["JwtSettings:Key"] ?? throw new InvalidOperationException("JWT Key missing");
            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            var token = new JwtSecurityToken(
                issuer: "AI-ComSign",
                audience: "AI-ComSign",
                expires: DateTime.UtcNow.AddDays(7),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized("Token is missing or contains an invalid user identifier.");
            }

            var learner = await _context.Learners.FindAsync(userId);

            if (learner == null)
            {
                return NotFound("User not found.");
            }

            return Ok(new
            {
                learner.Id,
                learner.Name,
                learner.Email,
                learner.DateOfBirth,
                learner.CreatedAt,
                learner.Role
            });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var learner = await _context.Learners.FirstOrDefaultAsync(l => l.Email == dto.Email);
            if (learner != null)
            {
                var token = Guid.NewGuid().ToString();
                var resetToken = new PasswordResetToken
                {
                    LearnerId = learner.Id,
                    Token = token,
                    ExpirationTime = DateTime.UtcNow.AddHours(1)
                };
                
                _context.PasswordResetTokens.Add(resetToken);
                await _context.SaveChangesAsync();
                
                return Ok(new { message = "Reset token generated", token = token });
            }
            
            return BadRequest(new { message = "Email not found." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var resetToken = await _context.PasswordResetTokens
                .Include(t => t.Learner)
                .FirstOrDefaultAsync(t => t.Token == dto.Token && !t.Used);

            if (resetToken == null || resetToken.ExpirationTime < DateTime.UtcNow)
            {
                return BadRequest("Invalid or expired token.");
            }

            var learner = resetToken.Learner;
            if (learner == null)
            {
                return BadRequest("Invalid token.");
            }

            learner.PasswordHash = _passwordHasher.HashPassword(learner, dto.NewPassword);
            resetToken.Used = true;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Password reset successful" });
        }
    }
}
