using AI_BE.Data;
using AI_BE.DTO;
using AI_BE.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_BE.Controllers
{
    [ApiController]
    [Route("api/admin/users")]
    [Authorize(Roles = "Admin")]
    public class AdminUserController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminUserController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Learners
                .Select(u => new UserDto
                {
                    Id = u.Id,
                    Email = u.Email,
                    Name = u.Name,
                    PhoneNumber = u.PhoneNumber,
                    DateOfBirth = u.DateOfBirth,
                    CreatedAt = u.CreatedAt,
                    Role = u.Role
                })
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();

            return Ok(users);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUser(Guid id)
        {
            var user = await _context.Learners.FindAsync(id);
            if (user == null)
            {
                return NotFound("Người dùng không tồn tại.");
            }

            var userDto = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.Name,
                PhoneNumber = user.PhoneNumber,
                DateOfBirth = user.DateOfBirth,
                CreatedAt = user.CreatedAt,
                Role = user.Role
            };

            return Ok(userDto);
        }

        [HttpPut("{id}/role")]
        public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleDto dto)
        {
            if (dto.Role != "Admin" && dto.Role != "Learner")
            {
                return BadRequest("Role không hợp lệ. Phải là 'Admin' hoặc 'Learner'.");
            }

            var user = await _context.Learners.FindAsync(id);
            if (user == null)
            {
                return NotFound("Người dùng không tồn tại.");
            }

            user.Role = dto.Role;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã cập nhật role của user {user.Email} thành {user.Role}" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var user = await _context.Learners.FindAsync(id);
            if (user == null)
            {
                return NotFound("Người dùng không tồn tại.");
            }

            _context.Learners.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã xóa người dùng {user.Email}" });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var totalUsers = await _context.Learners.CountAsync();
            var totalLessons = await _context.Lessons.CountAsync();
            var totalSigns = await _context.SignSamples.CountAsync();

            return Ok(new
            {
                TotalUsers = totalUsers,
                TotalLessons = totalLessons,
                TotalSigns = totalSigns
            });
        }
    }
}
