# Stage 1: Build the application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project file and restore dependencies (layer caching)
COPY ["AI-BE.csproj", "./"]
RUN dotnet restore "AI-BE.csproj"

# Copy the remaining source code
COPY . .

# Build and publish the application
RUN dotnet publish "AI-BE.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Create the runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Run as non-root user for security (optional but recommended)
# USER app

# Expose the port the app runs on (default for .NET 8+ is 8080)
EXPOSE 8080

# Copy the published application from the build stage
COPY --from=build /app/publish .

# Set the entry point
ENTRYPOINT ["dotnet", "AI-BE.dll"]
