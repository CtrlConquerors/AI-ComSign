using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AI_BE.Migrations
{
    /// <inheritdoc />
    public partial class AddRoleToLearner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "Learners",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Role",
                table: "Learners");
        }
    }
}
