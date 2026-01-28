using Microsoft.EntityFrameworkCore;
using AI_BE.Models;

namespace AI_BE.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<SignSample> SignSamples { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.Entity<SignSample>()
            .Property(s => s.Landmarks)
            .HasColumnType("jsonb");
    }
}
