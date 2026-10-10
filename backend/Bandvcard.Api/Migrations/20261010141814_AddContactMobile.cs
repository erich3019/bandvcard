using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bandvcard.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContactMobile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Mobile",
                table: "Contacts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Mobile",
                table: "Contacts");
        }
    }
}
