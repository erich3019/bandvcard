using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bandvcard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAbacusImportedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AbacusImportedAt",
                table: "Contacts",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AbacusImportedAt",
                table: "Contacts");
        }
    }
}
