using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AI_BE.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LessonId",
                table: "SignSamples",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Lesson",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Level = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lesson", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SignSamples_LessonId",
                table: "SignSamples",
                column: "LessonId");

            migrationBuilder.AddForeignKey(
                name: "FK_SignSamples_Lesson_LessonId",
                table: "SignSamples",
                column: "LessonId",
                principalTable: "Lesson",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SignSamples_Lesson_LessonId",
                table: "SignSamples");

            migrationBuilder.DropTable(
                name: "Lesson");

            migrationBuilder.DropIndex(
                name: "IX_SignSamples_LessonId",
                table: "SignSamples");

            migrationBuilder.DropColumn(
                name: "LessonId",
                table: "SignSamples");
        }
    }
}
