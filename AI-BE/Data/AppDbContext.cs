using Microsoft.EntityFrameworkCore;
using AI_BE.Models;

namespace AI_BE.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<SignSample> SignSamples { get; set; }

    public DbSet<PracticeSession> PracticeSessions => Set<PracticeSession>();
    public DbSet<Attempt> Attempts => Set<Attempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Lesson>().ToTable("Lessons");

        modelBuilder.Entity<SignSample>()
            .Property(s => s.Landmarks)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Lesson>()
            .HasMany(l => l.Signs)
            .WithOne(s => s.Lesson)
            .HasForeignKey(s => s.LessonId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Attempt>()
            .Property(a => a.RecordMotionData)
            .HasColumnType("jsonb");

        modelBuilder.Entity<PracticeSession>()
            .HasMany(p => p.Attempts)
            .WithOne(a => a.Session)
            .HasForeignKey(a => a.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
