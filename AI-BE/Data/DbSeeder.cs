using AI_BE.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AI_BE.Data;

/// <summary>
/// Idempotent seeder: creates a default Admin and a default Learner
/// on first run. Existing accounts (matched by email) are left untouched.
///
/// Credentials are read from configuration:
///   Seed:Admin:Email, Seed:Admin:Password, Seed:Admin:Name
///   Seed:Learner:Email, Seed:Learner:Password, Seed:Learner:Name
/// Skip by leaving Email/Password empty.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(
        AppDbContext context,
        IPasswordHasher<Learner> passwordHasher,
        IConfiguration configuration,
        ILogger logger)
    {
        await SeedRoleAsync(context, passwordHasher, configuration, logger, role: "Admin", section: "Seed:Admin");
        await SeedRoleAsync(context, passwordHasher, configuration, logger, role: "Learner", section: "Seed:Learner");
    }

    private static async Task SeedRoleAsync(
        AppDbContext context,
        IPasswordHasher<Learner> passwordHasher,
        IConfiguration configuration,
        ILogger logger,
        string role,
        string section)
    {
        var email = configuration[$"{section}:Email"];
        var password = configuration[$"{section}:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogInformation("DbSeeder: skipping {Role} (no {Section}:Email/Password configured).", role, section);
            return;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();

        var existing = await context.Learners
            .FirstOrDefaultAsync(l => l.Email.ToLower() == normalizedEmail);

        if (existing != null)
        {
            // Make sure the existing row has the right role even if it was created
            // before this account was designated as the seed account.
            if (existing.Role != role)
            {
                existing.Role = role;
                await context.SaveChangesAsync();
                logger.LogInformation("DbSeeder: updated role of {Email} to {Role}.", existing.Email, role);
            }
            else
            {
                logger.LogInformation("DbSeeder: {Role} account {Email} already exists, leaving untouched.", role, existing.Email);
            }
            return;
        }

        var name = configuration[$"{section}:Name"];
        if (string.IsNullOrWhiteSpace(name)) name = role;

        var learner = new Learner
        {
            Id = Guid.NewGuid(),
            Email = email.Trim(),
            Name = name,
            PhoneNumber = null,
            PasswordHash = passwordHasher.HashPassword(null!, password),
            DateOfBirth = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow,
            Role = role
        };

        context.Learners.Add(learner);
        await context.SaveChangesAsync();

        logger.LogInformation("DbSeeder: created {Role} account {Email}.", role, learner.Email);
    }
}
