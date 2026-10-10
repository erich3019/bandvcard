FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Bandvcard.Api/Bandvcard.Api.csproj Bandvcard.Api/
RUN dotnet restore Bandvcard.Api/Bandvcard.Api.csproj
COPY Bandvcard.Api/ Bandvcard.Api/
RUN dotnet publish Bandvcard.Api/Bandvcard.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# Session cookie keys; the volume mounted here inherits this ownership.
RUN mkdir /keys && chown $APP_UID /keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Bandvcard.Api.dll"]
