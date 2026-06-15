using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AI_BE.Migrations
{
    /// <summary>
    /// The Learner model has had a CreatedAt property since the initial
    /// commit, but the original "InitialSimplifiedSchema1" migration
    /// forgot to add the column. The model snapshot already represents
    /// the desired schema (with CreatedAt), so EF will not auto-generate
    /// a migration for the drift. This migration closes the gap by
    /// adding the column and backfilling any existing rows.
    /// </summary>
    public partial class AddLearnerCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Adding a NOT NULL column with a DEFAULT is safe on Postgres:
            //   - empty table: no rows to violate the constraint
            //   - existing rows: PG backfills them with the default value
            //   - future rows: the default is applied automatically
            // No pre-existing data migration step is required, so no separate
            // UPDATE backfill is needed (and would actually fail on a fresh
            // table where the column does not exist yet).
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Learners",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Learners");
        }
    }
}
