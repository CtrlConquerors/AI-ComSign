using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AI_BE.Migrations
{
    /// <inheritdoc />
    public partial class UpdateTableNamesToPlural : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SignSamples_Lesson_LessonId",
                table: "SignSamples");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Lesson",
                table: "Lesson");

            migrationBuilder.RenameTable(
                name: "Lesson",
                newName: "Lessons");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Lessons",
                table: "Lessons",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SignSamples_Lessons_LessonId",
                table: "SignSamples",
                column: "LessonId",
                principalTable: "Lessons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SignSamples_Lessons_LessonId",
                table: "SignSamples");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Lessons",
                table: "Lessons");

            migrationBuilder.RenameTable(
                name: "Lessons",
                newName: "Lesson");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Lesson",
                table: "Lesson",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SignSamples_Lesson_LessonId",
                table: "SignSamples",
                column: "LessonId",
                principalTable: "Lesson",
                principalColumn: "Id");
        }
    }
}
