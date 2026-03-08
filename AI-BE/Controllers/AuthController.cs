using AI_BE.Data;
using AI_BE.DTO;
using AI_BE.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
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
                return BadRequest("Email đã tồn tại.");
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

            return Ok(new { message = "Đăng ký Learner thành công!" });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var learner = await _context.Learners.FirstOrDefaultAsync(l => l.Email == dto.Email);

            if (learner == null || _passwordHasher.VerifyHashedPassword(learner, learner.PasswordHash, dto.Password) == PasswordVerificationResult.Failed)
            {
                return Unauthorized("Email hoặc mật khẩu không đúng.");
            }

            var token = GenerateJwtToken(learner);

            return Ok(new
            {
                token,
                message = "Đăng nhập thành công!"
            });
        }

        private string GenerateJwtToken(Learner learner)
        {
            var authClaims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, learner.Name),
                new Claim(ClaimTypes.Email, learner.Email),
                new Claim(ClaimTypes.NameIdentifier, learner.Id.ToString()),
                new Claim("PhoneNumber", learner.PhoneNumber ?? ""),
                new Claim("DateOfBirth", learner.DateOfBirth.ToString("yyyy-MM-dd"))
            };

            var jwtKey = _config["JwtSettings:Key"] ?? throw new InvalidOperationException("JWT Key missing");
            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            var token = new JwtSecurityToken(
                expires: DateTime.Now.AddDays(7),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        [Authorize] 
        [HttpGet("profile")] 
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized("Token không hợp lệ hoặc thiếu thông tin.");
            }

            var learner = await _context.Learners.FindAsync(Guid.Parse(userIdClaim));

            if (learner == null)
            {
                return NotFound("Không tìm thấy thông tin người dùng.");
            }

            return Ok(new
            {
                learner.Id,
                learner.Name,
                learner.Email,
                learner.DateOfBirth,
                learner.CreatedAt
            });
        }
    }
}