# Build stage (.NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish Proyecto_ai.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
# Render inyecta $PORT. Hay que escuchar ahi o el deploy falla (port scan timeout).
CMD ["sh", "-c", "dotnet Proyecto_ai.dll --urls http://*:$PORT"]
