using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using InternalApps.Api.Infrastructure;
using Microsoft.IdentityModel.Tokens;

namespace InternalApps.Api.Authentication;

internal sealed class TokenService(JwtSettings settings)
{
    public IssuedTokens Issue(AuthUser user, DateTimeOffset now)
    {
        var accessTokenExpiresAt = now.AddMinutes(settings.AccessTokenMinutes);
        var refreshTokenExpiresAt = now.AddDays(settings.RefreshTokenDays);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.PublicId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(ClaimTypes.Name, user.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
        claims.AddRange(user.Permissions.Select(
            permission => new Claim("permission", permission)));

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SigningKey));
        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: accessTokenExpiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(
                signingKey,
                SecurityAlgorithms.HmacSha256));

        var refreshToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));

        return new IssuedTokens(
            new JwtSecurityTokenHandler().WriteToken(token),
            accessTokenExpiresAt,
            refreshToken,
            refreshTokenExpiresAt);
    }

    public static string HashRefreshToken(string refreshToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
