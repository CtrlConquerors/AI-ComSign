using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AI_BE.Migrations
{
    /// <inheritdoc />
    public partial class ManyToManyLessonSigns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create LessonSigns BEFORE dropping LessonId so we can migrate existing data
            migrationBuilder.CreateTable(
                name: "LessonSigns",
                columns: table => new
                {
                    LessonId = table.Column<int>(type: "integer", nullable: false),
                    SignName = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonSigns", x => new { x.LessonId, x.SignName });
                    table.ForeignKey(
                        name: "FK_LessonSigns_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Migrate existing assignments: one row per distinct (LessonId, SignName) pair
            migrationBuilder.Sql(@"
                INSERT INTO ""LessonSigns"" (""LessonId"", ""SignName"")
                SELECT DISTINCT ""LessonId"", ""SignName""
                FROM ""SignSamples""
                WHERE ""LessonId"" IS NOT NULL
                ON CONFLICT DO NOTHING;
            ");

            migrationBuilder.DropForeignKey(
                name: "FK_SignSamples_Lessons_LessonId",
                table: "SignSamples");

            migrationBuilder.DropIndex(
                name: "IX_SignSamples_LessonId",
                table: "SignSamples");

            migrationBuilder.DropColumn(
                name: "LessonId",
                table: "SignSamples");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LessonSigns");

            migrationBuilder.AddColumn<int>(
                name: "LessonId",
                table: "SignSamples",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SignSamples_LessonId",
                table: "SignSamples",
                column: "LessonId");

            migrationBuilder.AddForeignKey(
                name: "FK_SignSamples_Lessons_LessonId",
                table: "SignSamples",
                column: "LessonId",
                principalTable: "Lessons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
