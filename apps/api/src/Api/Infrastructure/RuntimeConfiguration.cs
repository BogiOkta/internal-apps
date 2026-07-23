using System.Text;
using Npgsql;

namespace InternalApps.Api.Infrastructure;

internal static class RuntimeConfiguration
{
    public static NpgsqlDataSource CreateDataSource()
    {
        var portValue = GetRequired("DB_PORT");
        if (!int.TryParse(portValue, out var port) || port is < 1 or > 65535)
        {
            throw new InvalidOperationException("DB_PORT must be an integer between 1 and 65535.");
        }

        var sslModeValue = GetRequired("DB_SSL_MODE");
        if (!Enum.TryParse<SslMode>(sslModeValue, true, out var sslMode) ||
            !Enum.IsDefined(sslMode))
        {
            throw new InvalidOperationException("DB_SSL_MODE is invalid.");
        }

        var trustValue = GetRequired("DB_TRUST_SERVER_CERTIFICATE");
        if (!bool.TryParse(trustValue, out var trustServerCertificate))
        {
            throw new InvalidOperationException(
                "DB_TRUST_SERVER_CERTIFICATE must be true or false.");
        }

        var password = GetRequired("APP_DB_PASSWORD");
        RejectPlaceholder("APP_DB_PASSWORD", password, "change_me_later");

        var connectionString = new NpgsqlConnectionStringBuilder
        {
            Host = GetRequired("DB_HOST"),
            Port = port,
            Database = GetRequired("DB_NAME"),
            Username = GetRequired("APP_DB_USER"),
            Password = password,
            SslMode = sslMode,
            ApplicationName = "InternalApps.Api",
            IncludeErrorDetail = false,
            PersistSecurityInfo = false
        };
        connectionString["Trust Server Certificate"] = trustServerCertificate;

        return NpgsqlDataSource.Create(connectionString.ConnectionString);
    }

    public static JwtSettings GetJwtSettings()
    {
        var signingKey = GetRequired("JWT_SIGNING_KEY");
        RejectPlaceholder(
            "JWT_SIGNING_KEY",
            signingKey,
            "replace_with_at_least_32_random_characters");

        if (Encoding.UTF8.GetByteCount(signingKey) < 32)
        {
            throw new InvalidOperationException(
                "JWT_SIGNING_KEY must contain at least 32 UTF-8 bytes.");
        }

        return new JwtSettings(
            GetRequired("JWT_ISSUER"),
            GetRequired("JWT_AUDIENCE"),
            signingKey,
            GetPositiveInteger("JWT_ACCESS_TOKEN_MINUTES"),
            GetPositiveInteger("JWT_REFRESH_TOKEN_DAYS"));
    }

    private static int GetPositiveInteger(string name)
    {
        var value = GetRequired(name);
        if (!int.TryParse(value, out var result) || result <= 0)
        {
            throw new InvalidOperationException($"{name} must be a positive integer.");
        }

        return result;
    }

    private static string GetRequired(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                $"Required environment variable {name} is not set.");
        }

        return value;
    }

    private static void RejectPlaceholder(string name, string value, string placeholder)
    {
        if (string.Equals(value, placeholder, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"{name} still contains the example placeholder.");
        }
    }
}

internal sealed record JwtSettings(
    string Issuer,
    string Audience,
    string SigningKey,
    int AccessTokenMinutes,
    int RefreshTokenDays);
