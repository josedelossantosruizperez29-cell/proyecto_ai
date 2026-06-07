using Microsoft.EntityFrameworkCore;
using Proyecto_ai.Models;
namespace Proyecto_ai.Data
{
    public class AppDbContext: DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) 
            :base(options)
        {
        }
        public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>().ToTable("users");
            modelBuilder.Entity<User>()
            .Property(u => u.CreatedAt)
            .HasColumnName("created_at");


            modelBuilder.Entity<User>()
            .Property(u => u.PasswordHash)
            .HasColumnName("password_hash");
        }


    }
}
