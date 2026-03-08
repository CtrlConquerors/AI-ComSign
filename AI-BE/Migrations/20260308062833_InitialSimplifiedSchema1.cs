using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AI_BE.Migrations
{
    /// <inheritdoc />
    public partial class InitialSimplifiedSchema1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
    name: "Learners",
    columns: table => new
    {
        Id = table.Column<Guid>(type: "uuid", nullable: false),
        Email = table.Column<string>(type: "text", nullable: false),
        PasswordHash = table.Column<string>(type: "text", nullable: false),
        Name = table.Column<string>(type: "text", nullable: false),
        PhoneNumber = table.Column<string>(type: "text", nullable: true),
        DateOfBirth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
    },
    constraints: table =>
    {
        table.PrimaryKey("PK_Learners", x => x.Id);
    });

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
