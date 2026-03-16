using Microsoft.EntityFrameworkCore;
using AI_BE.Models;

namespace AI_BE.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Learner> Learners => Set<Learner>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<LessonSign> LessonSigns => Set<LessonSign>();
    public DbSet<SignSample> SignSamples { get; set; }
    public DbSet<PracticeSession> PracticeSessions => Set<PracticeSession>();
    public DbSet<Attempt> Attempts => Set<Attempt>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Lesson>().ToTable("Lessons");

        // LessonSign: composite primary key (LessonId, SignName)
        modelBuilder.Entity<LessonSign>()
            .HasKey(ls => new { ls.LessonId, ls.SignName });

        modelBuilder.Entity<LessonSign>()
            .HasOne(ls => ls.Lesson)
            .WithMany(l => l.LessonSigns)
            .HasForeignKey(ls => ls.LessonId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SignSample>()
            .Property(s => s.Landmarks)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Attempt>()
            .Property(a => a.RecordMotionData)
            .HasColumnType("jsonb");

        modelBuilder.Entity<PracticeSession>()
            .HasMany(p => p.Attempts)
            .WithOne(a => a.Session)
            .HasForeignKey(a => a.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PracticeSession>()
            .HasOne(p => p.Lesson)
            .WithMany()
            .HasForeignKey(p => p.LessonId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PracticeSession>()
            .HasOne<Learner>()
            .WithMany()
            .HasForeignKey(p => p.LearnerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
