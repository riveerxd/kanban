using Microsoft.EntityFrameworkCore;
using backend.Models;

namespace backend.Data;

/// <summary>
/// Application database context for Entity Framework Core.
/// </summary>
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<Board> Boards { get; set; } = null!;
    public DbSet<Column> Columns { get; set; } = null!;
    public DbSet<Models.Task> Tasks { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure User entity
        modelBuilder.Entity<User>(entity =>
        {
            // Create unique index on Email
            entity.HasIndex(e => e.Email)
                .IsUnique()
                .HasDatabaseName("IX_Users_Email");

            // Create unique index on Username
            entity.HasIndex(e => e.Username)
                .IsUnique()
                .HasDatabaseName("IX_Users_Username");

            // Configure CreatedAt column type
            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime");
        });

        // Configure Board entity
        modelBuilder.Entity<Board>(entity =>
        {
            entity.HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime");
        });

        // Configure Column entity
        modelBuilder.Entity<Column>(entity =>
        {
            entity.HasOne(c => c.Board)
                .WithMany(b => b.Columns)
                .HasForeignKey(c => c.BoardId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime");

            entity.HasIndex(c => new { c.BoardId, c.Position });
        });

        // Configure Task entity
        modelBuilder.Entity<Models.Task>(entity =>
        {
            entity.HasOne(t => t.Column)
                .WithMany(c => c.Tasks)
                .HasForeignKey(t => t.ColumnId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime");

            entity.HasIndex(t => new { t.ColumnId, t.Position });
        });
    }
}
