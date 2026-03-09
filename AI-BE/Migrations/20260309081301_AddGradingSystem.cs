using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AI_BE.Migrations
{
    /// <inheritdoc />
    public partial class AddGradingSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_SignSamples_SignId",
                table: "Attempts");

            migrationBuilder.RenameColumn(
                name: "TotalScore",
                table: "PracticeSessions",
                newName: "PassRate");

            // PostgreSQL cannot cast int to uuid automatically; drop and recreate.
            // Dev data only - no production records in PracticeSessions yet.
            migrationBuilder.DropColumn(
                name: "LearnerId",
                table: "PracticeSessions");

            migrationBuilder.AddColumn<Guid>(
                name: "LearnerId",
                table: "PracticeSessions",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.AddColumn<int>(
                name: "LessonId",
                table: "PracticeSessions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PassedSigns",
                table: "PracticeSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TotalSigns",
                table: "PracticeSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "SignId",
                table: "Attempts",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<bool>(
                name: "IsSkipped",
                table: "Attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Passed",
                table: "Attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SignName",
                table: "Attempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessions_LearnerId",
                table: "PracticeSessions",
                column: "LearnerId");

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessions_LessonId",
                table: "PracticeSessions",
                column: "LessonId");

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_SignSamples_SignId",
                table: "Attempts",
                column: "SignId",
                principalTable: "SignSamples",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_PracticeSessions_Learners_LearnerId",
                table: "PracticeSessions",
                column: "LearnerId",
                principalTable: "Learners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PracticeSessions_Lessons_LessonId",
                table: "PracticeSessions",
                column: "LessonId",
                principalTable: "Lessons",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attempts_SignSamples_SignId",
                table: "Attempts");

            migrationBuilder.DropForeignKey(
                name: "FK_PracticeSessions_Learners_LearnerId",
                table: "PracticeSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_PracticeSessions_Lessons_LessonId",
                table: "PracticeSessions");

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessions_LearnerId",
                table: "PracticeSessions");

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessions_LessonId",
                table: "PracticeSessions");

            migrationBuilder.DropColumn(
                name: "LessonId",
                table: "PracticeSessions");

            migrationBuilder.DropColumn(
                name: "PassedSigns",
                table: "PracticeSessions");

            migrationBuilder.DropColumn(
                name: "TotalSigns",
                table: "PracticeSessions");

            migrationBuilder.DropColumn(
                name: "IsSkipped",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "Passed",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "SignName",
                table: "Attempts");

            migrationBuilder.RenameColumn(
                name: "PassRate",
                table: "PracticeSessions",
                newName: "TotalScore");

            migrationBuilder.DropColumn(
                name: "LearnerId",
                table: "PracticeSessions");

            migrationBuilder.AddColumn<int>(
                name: "LearnerId",
                table: "PracticeSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "SignId",
                table: "Attempts",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Attempts_SignSamples_SignId",
                table: "Attempts",
                column: "SignId",
                principalTable: "SignSamples",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
